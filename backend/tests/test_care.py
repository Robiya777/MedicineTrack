import io
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections, connection, connections
from django.utils import timezone
from pypdf import PdfWriter

from care.jobs import deliver_outbox, scan_deadlines
from care.models import CareTask, Discharge, Notification, OutboxEvent, VisitReport
from care.services import confirm_discharge

pytestmark = pytest.mark.django_db


def test_confirm_is_atomic_and_repeatable(world, client_for):
    client = client_for(world.staff)
    url = f"/api/v1/discharges/{world.discharge.id}/confirm"
    first = client.post(url, {}, format="json")
    second = client.post(url, {}, format="json")
    assert (first.status_code, second.status_code) == (201, 200)
    assert first.data["id"] == second.data["id"]
    assert CareTask.objects.count() == 1
    task = CareTask.objects.get()
    assert task.assigned_doctor == world.doctor
    assert task.due_at == world.discharge.discharged_at + timedelta(hours=24)
    assert OutboxEvent.objects.filter(event_type="TASK_CREATED").count() == 1
    assert first.data["patient"]["full_name"] == world.patient.full_name


@pytest.mark.parametrize("inactive", [True, False])
def test_missing_or_inactive_assignment_goes_to_coordinator(world, inactive):
    if inactive:
        world.doctor.is_active = False
        world.doctor.save()
    else:
        world.assignment.delete()
    task, _ = confirm_discharge(world.discharge.pk, world.staff)
    assert task.status == "UNASSIGNED" and task.assigned_doctor_id is None
    assert OutboxEvent.objects.get(event_type="TASK_CREATED", recipient=world.coordinator).recipient == world.coordinator


def test_late_discharge_escalates_without_reminder_flood(world):
    world.discharge.discharged_at = timezone.now() - timedelta(hours=25)
    world.discharge.save()
    task, _ = confirm_discharge(world.discharge.pk, world.staff)
    scan_deadlines()
    scan_deadlines()
    assert task.due_at < timezone.now()
    assert OutboxEvent.objects.filter(event_type="TASK_OVERDUE", recipient=world.coordinator).count() == 1
    assert not OutboxEvent.objects.filter(event_type__startswith="TASK_REMINDER").exists()


def test_future_confirm_does_not_create_partial_records(world, client_for):
    world.discharge.discharged_at = timezone.now() + timedelta(hours=1)
    world.discharge.save()
    response = client_for(world.staff).post(
        f"/api/v1/discharges/{world.discharge.id}/confirm", {}, format="json"
    )
    assert response.status_code == 400
    assert not CareTask.objects.exists() and not OutboxEvent.objects.exists()


def test_doctor_workflow_contact_then_complete(world, task, client_for):
    client = client_for(world.doctor)
    base = f"/api/v1/tasks/{task.pk}"
    accepted = client.post(f"{base}/accept", {"version": 1}, format="json")
    assert accepted.status_code == 200 and accepted.data["status"] == "ACCEPTED"
    assert not VisitReport.objects.exists()
    contact = client.post(
        f"{base}/contact-attempts",
        {
            "version": 2,
            "channel": "PHONE",
            "result": "NO_ANSWER",
            "attempted_at": timezone.now().isoformat(),
            "note": "Synthetic attempt",
            "next_action": "Try again",
        },
        format="json",
    )
    assert contact.status_code == 201 and contact.data["status"] == "ACCEPTED"
    payload = {
        "version": 3,
        "performed_at": timezone.now().isoformat(),
        "channel": "PHONE",
        "observation": "Synthetic observation",
        "actions": "Synthetic action",
        "follow_up": "Synthetic plan",
    }
    first = client.post(
        f"{base}/complete", payload, format="json", HTTP_IDEMPOTENCY_KEY="complete-once"
    )
    second = client.post(
        f"{base}/complete", payload, format="json", HTTP_IDEMPOTENCY_KEY="complete-once"
    )
    assert first.status_code == second.status_code == 200
    assert second["Idempotency-Replayed"] == "true"
    assert first.data["status"] == "COMPLETED"
    assert VisitReport.objects.count() == 1


def test_idempotency_payload_conflict(world, task, client_for):
    client = client_for(world.doctor)
    url = f"/api/v1/tasks/{task.id}/accept"
    assert (
        client.post(url, {"version": 1}, format="json", HTTP_IDEMPOTENCY_KEY="one").status_code
        == 200
    )
    assert (
        client.post(url, {"version": 2}, format="json", HTTP_IDEMPOTENCY_KEY="one").status_code
        == 409
    )


def test_complete_requires_accept_and_valid_time(world, task, client_for):
    client = client_for(world.doctor)
    url = f"/api/v1/tasks/{task.id}"
    payload = {
        "version": 1,
        "performed_at": timezone.now().isoformat(),
        "channel": "PHONE",
        "observation": "Test",
        "actions": "Test",
        "follow_up": "Test",
    }
    assert client.post(f"{url}/complete", payload, format="json").status_code == 409
    assert client.post(f"{url}/accept", {"version": 1}, format="json").status_code == 200
    payload.update(version=2, performed_at=(timezone.now() + timedelta(days=1)).isoformat())
    assert client.post(f"{url}/complete", payload, format="json").status_code == 400
    assert not VisitReport.objects.exists()


def test_reassign_preserves_deadline_and_revokes_old_access(world, task, client_for):
    client_for(world.doctor).post(f"/api/v1/tasks/{task.id}/accept", {"version": 1}, format="json")
    response = client_for(world.coordinator).post(
        f"/api/v1/tasks/{task.id}/reassign",
        {"version": 2, "doctor_id": str(world.doctor2.id), "reason": "Synthetic reassignment"},
        format="json",
    )
    assert response.status_code == 200
    task.refresh_from_db()
    assert task.status == "NEW" and task.accepted_at is None
    assert task.due_at == world.discharge.discharged_at + timedelta(hours=24)
    assert task.assignment_history.count() == 1
    assert client_for(world.doctor).get(f"/api/v1/tasks/{task.pk}").status_code == 404
    assert client_for(world.doctor).get(f"/api/v1/patients/{world.patient.pk}").status_code == 404


@pytest.mark.parametrize("role_name", ["outsider", "admin", "doctor2"])
def test_cross_scope_access_is_filtered(world, task, client_for, role_name):
    client = client_for(getattr(world, role_name))
    assert client.get(f"/api/v1/tasks/{task.id}").status_code == 404
    assert client.get("/api/v1/tasks").data["count"] == 0
    assert client.get(f"/api/v1/discharges/{world.discharge.id}").status_code == 404


def test_patient_validations_and_snapshot_are_stable(world, task, client_for):
    client = client_for(world.staff)
    invalid = client.post(
        "/api/v1/patients",
        {
            "full_name": "Synthetic",
            "birth_date": "2999-01-01",
            "address": "Demo",
            "territory": str(world.territory.id),
            "contact": "123",
        },
        format="json",
    )
    assert invalid.status_code == 400
    assert (
        client.patch(
            f"/api/v1/patients/{world.patient.id}", {"contact": "+998900000002"}, format="json"
        ).status_code
        == 409
    )
    Discharge.objects.create(
        patient=world.patient,
        hospital=world.hospital,
        managing_organization=world.hospital,
        created_by=world.staff,
        discharged_at=timezone.now(),
        recommendations="Synthetic",
        follow_up_reason="Synthetic",
    )
    assert (
        client.patch(
            f"/api/v1/patients/{world.patient.id}",
            {"address": "New synthetic address"},
            format="json",
        ).status_code
        == 200
    )
    response = client_for(world.doctor).get(f"/api/v1/tasks/{task.id}")
    assert response.data["patient"]["address"] == "Synthetic address"


def test_outbox_restart_and_terminal_suppression(world, task, client_for):
    deliver_outbox()
    OutboxEvent.objects.update(delivery_status="PENDING")
    deliver_outbox()
    assert Notification.objects.count() == 1
    Notification.objects.all().delete()
    OutboxEvent.objects.update(delivery_status="PENDING")
    response = client_for(world.coordinator).post(
        f"/api/v1/tasks/{task.id}/cancel",
        {"version": 1, "reason_code": "ERROR", "reason": "Synthetic correction"},
        format="json",
    )
    assert response.status_code == 200
    deliver_outbox()
    assert not Notification.objects.exists()


def test_metrics_exclude_future_open_tasks(world, task, client_for):
    response = client_for(world.coordinator).get("/api/v1/dashboard/metrics")
    assert response.data["active"] == 1
    assert response.data["assessed"] == 0 and response.data["sla_percent"] is None


def test_pdf_private_download_and_validation(world, client_for):
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    content = io.BytesIO()
    writer.write(content)
    staff = client_for(world.staff)
    url = f"/api/v1/discharges/{world.discharge.id}/attachments"
    bad = staff.post(
        url,
        {"file": SimpleUploadedFile("fake.pdf", b"not a PDF", content_type="application/pdf")},
        format="multipart",
    )
    assert bad.status_code == 400
    big = staff.post(
        url,
        {
            "file": SimpleUploadedFile(
                "huge.pdf", b"%PDF-" + b"0" * (10 * 1024 * 1024), content_type="application/pdf"
            )
        },
        format="multipart",
    )
    assert big.status_code == 413
    good = staff.post(
        url,
        {
            "file": SimpleUploadedFile(
                "../../test.pdf", content.getvalue(), content_type="application/pdf"
            )
        },
        format="multipart",
    )
    assert good.status_code == 201
    download = f"/api/v1/attachments/{good.data['id']}/download"
    assert client_for(world.outsider).get(download).status_code == 404
    assert client_for(world.admin).get(download).status_code == 404
    assert staff.get(download).status_code == 200
    task, _ = confirm_discharge(world.discharge.pk, world.staff)
    detail = client_for(world.doctor).get(f"/api/v1/tasks/{task.id}")
    assert detail.data["attachments"][0]["download_url"] == download
    assert client_for(world.doctor).get(download).status_code == 200


@pytest.mark.django_db(transaction=True)
def test_parallel_confirm_creates_one_task(world):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock concurrency is verified on PostgreSQL.")
    pk, user = world.discharge.pk, world.staff

    def confirm(_):
        close_old_connections()
        try:
            return confirm_discharge(pk, user)[0].id
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(confirm, range(2)))
    assert results[0] == results[1]
    assert CareTask.objects.count() == 1
    assert OutboxEvent.objects.filter(event_type="TASK_CREATED").count() == 1


def test_invalid_identifiers_do_not_leak_or_crash(world, client_for):
    client = client_for(world.staff)
    assert client.get("/api/v1/patients", {"id": "invalid"}).status_code == 400
    assert client.get("/api/v1/tasks", {"doctor_id": "invalid"}).status_code == 400
    assert client.get(f"/api/v1/tasks/{uuid.uuid4()}").status_code == 404
    assert client.get(f"/api/v1/tasks/{'-' * 36}").status_code == 404


@pytest.mark.django_db(transaction=True)
def test_parallel_idempotent_confirm_returns_same_response(world):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock concurrency is verified on PostgreSQL.")
    from rest_framework.test import APIClient

    def request(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(world.staff)
            response = client.post(
                f"/api/v1/discharges/{world.discharge.pk}/confirm",
                {},
                format="json",
                HTTP_IDEMPOTENCY_KEY="parallel",
            )
            return response.status_code, response.data["id"]
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(request, range(2)))
    assert results[0] == results[1]
    assert results[0][0] == 201 and CareTask.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_reassign_racing_complete_has_only_one_winner(world, task, client_for):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock concurrency is verified on PostgreSQL.")
    from rest_framework.test import APIClient

    assert (
        client_for(world.doctor)
        .post(f"/api/v1/tasks/{task.id}/accept", {"version": 1}, format="json")
        .status_code
        == 200
    )

    def request(action):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(world.doctor if action == "complete" else world.coordinator)
            payload = (
                {
                    "version": 2,
                    "performed_at": timezone.now().isoformat(),
                    "channel": "PHONE",
                    "observation": "Test",
                    "actions": "Test",
                    "follow_up": "Test",
                }
                if action == "complete"
                else {"version": 2, "doctor_id": str(world.doctor2.id), "reason": "Test"}
            )
            return client.post(
                f"/api/v1/tasks/{task.id}/{action}", payload, format="json"
            ).status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(request, ["complete", "reassign"]))
    assert results.count(200) == 1
    assert any(status in {403, 404, 409} for status in results)


def test_reassignment_blocks_cached_response_replay(world, task, client_for):
    client = client_for(world.doctor)
    url = f"/api/v1/tasks/{task.id}/accept"
    assert (
        client.post(
            url, {"version": 1}, format="json", HTTP_IDEMPOTENCY_KEY="accept-once"
        ).status_code
        == 200
    )
    client_for(world.coordinator).post(
        f"/api/v1/tasks/{task.id}/reassign",
        {"version": 2, "doctor_id": str(world.doctor2.id), "reason": "Synthetic"},
        format="json",
    )
    assert (
        client.post(
            url, {"version": 1}, format="json", HTTP_IDEMPOTENCY_KEY="accept-once"
        ).status_code
        == 404
    )


def test_hospital_account_moving_organization_loses_old_discharge_access(world, task, client_for):
    world.staff.organization = world.other_hospital
    world.staff.save()
    client = client_for(world.staff)
    assert client.get(f"/api/v1/discharges/{world.discharge.id}").status_code == 404
    assert client.get(f"/api/v1/tasks/{task.id}").status_code == 404
