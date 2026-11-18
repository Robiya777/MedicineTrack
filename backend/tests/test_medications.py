import copy
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta

import pytest
from django.db import close_old_connections, connection, connections
from django.utils import timezone
from freezegun import freeze_time
from rest_framework.test import APIClient

from accounts.models import Role, User
from care.models import AuditEvent, Patient
from medications.jobs import complete_courses
from medications.models import DoseOccurrence, DoseRecord, DoseRecordCorrection, MedicationPlan
from messaging.models import ResponseEpisode
from messaging.services import ensure_conversation

pytestmark = pytest.mark.django_db


@pytest.fixture
def medication_data(world):
    return {
        "discharge_id": str(world.discharge.id),
        "items": [
            {
                "name": "Sintetik demo dori",
                "prescribed_dose_text": "Faqat sintetik ko‘rsatma",
                "route": "Sintetik yo‘l",
                "source_reference": "Sintetik epikriz, 1-bet",
                "start_date": "2026-11-17",
                "end_date": "2026-11-18",
                "timezone": "Asia/Tashkent",
                "local_times": ["08:00", "20:00"],
            }
        ],
    }


@pytest.fixture
def draft(world, client_for, medication_data):
    response = client_for(world.staff).post(
        f"/api/v1/patients/{world.patient.id}/medication-plans", medication_data, format="json"
    )
    assert response.status_code == 201, response.data
    return response.data


def versions(plan):
    return {"version": plan["version"], "lock_version": plan["lock_version"]}


def grant_approval(doctor):
    doctor.can_approve_medication_schedule = True
    doctor.save(update_fields=["can_approve_medication_schedule"])


def approve(world, client_for, draft):
    grant_approval(world.doctor)
    response = client_for(world.doctor).post(
        f"/api/v1/medication-plans/{draft['id']}/approve", versions(draft), format="json"
    )
    assert response.status_code == 200, response.data
    return response.data


def record_payload(occurrence, result="TAKEN"):
    value = occurrence.scheduled_at + timedelta(minutes=1)
    return {
        "plan_version": occurrence.plan_version,
        "result": result,
        "reported_taken_at": value.isoformat() if result == "TAKEN" else None,
        "client_recorded_at": (value + timedelta(minutes=2)).isoformat(),
        "note": "Sintetik qayd",
    }


def test_draft_is_invisible_to_patient_and_creates_no_occurrences(world, draft, client_for):
    assert draft["status"] == "DRAFT"
    assert not DoseOccurrence.objects.exists()
    result = client_for(world.patient_user).get(
        f"/api/v1/patients/{world.patient.id}/medication-plans"
    )
    assert result.status_code == 200 and result.data["count"] == 0
    assert (
        client_for(world.patient_user)
        .get(f"/api/v1/medication-plans/{draft['id']}/occurrences")
        .status_code
        == 404
    )


@pytest.mark.parametrize("actor", ["staff", "admin", "coordinator", "doctor"])
def test_approval_needs_doctor_and_explicit_permission(world, draft, client_for, actor):
    user = getattr(world, actor)
    if actor != "doctor":
        user.can_approve_medication_schedule = True
        user.save()
    response = client_for(user).post(
        f"/api/v1/medication-plans/{draft['id']}/approve", versions(draft), format="json"
    )
    assert response.status_code in {403, 404}
    assert not DoseOccurrence.objects.exists()


@freeze_time("2026-11-17 07:00:00")
def test_approval_generates_bounded_deterministic_utc_occurrences(world, draft, client_for):
    plan = approve(world, client_for, draft)
    assert plan["status"] == "ACTIVE" and plan["version"] == 1
    rows = list(DoseOccurrence.objects.order_by("scheduled_at"))
    assert len(rows) == 4
    assert rows[0].scheduled_at == datetime(2026, 11, 17, 3, tzinfo=UTC)
    assert rows[-1].scheduled_at == datetime(2026, 11, 18, 15, tzinfo=UTC)
    assert rows[0].id == uuid.uuid5(rows[0].item_id, f"1:{rows[0].scheduled_at.isoformat()}")
    url = f"/api/v1/medication-plans/{plan['id']}/occurrences"
    result = client_for(world.patient_user).get(
        url, {"date_from": "2026-11-18", "date_to": "2026-11-18", "plan_version": 1}
    )
    assert result.status_code == 200 and result.data["count"] == 2
    assert result.data["server_time"] and result.data["cache_max_age_seconds"] == 86400
    assert client_for(world.patient_user).get(url, {"plan_version": 2}).status_code == 409


@pytest.mark.parametrize(
    "change",
    [
        {"prescribed_dose_text": None},
        {"local_times": []},
        {"timezone": ""},
        {"source_reference": ""},
        {"needs_clarification": True},
    ],
)
def test_incomplete_or_ambiguous_draft_cannot_be_approved(
    world, medication_data, client_for, change
):
    medication_data["items"][0].update(change)
    created = client_for(world.staff).post(
        f"/api/v1/patients/{world.patient.id}/medication-plans", medication_data, format="json"
    )
    assert created.status_code == 201
    grant_approval(world.doctor)
    result = client_for(world.doctor).post(
        f"/api/v1/medication-plans/{created.data['id']}/approve",
        versions(created.data),
        format="json",
    )
    assert result.status_code == 400
    assert MedicationPlan.objects.get().status == "DRAFT" and not DoseOccurrence.objects.exists()


@pytest.mark.parametrize(
    "change",
    [
        {"local_times": ["08:00", "08:00"]},
        {"local_times": [f"{hour:02}:00" for hour in range(9)]},
        {"timezone": "invalid/zone"},
        {"end_date": "2027-03-01"},
        {"end_date": "2026-01-01"},
        {"schedule_type": "AS_NEEDED"},
        {"end_date": "9999-12-31", "start_date": "9999-12-31"},
    ],
)
def test_resource_limits_and_invalid_times_are_rejected(world, medication_data, client_for, change):
    medication_data["items"][0].update(change)
    result = client_for(world.staff).post(
        f"/api/v1/patients/{world.patient.id}/medication-plans", medication_data, format="json"
    )
    assert result.status_code == 400 and not MedicationPlan.objects.exists()


def test_more_than_twenty_items_is_rejected(world, medication_data, client_for):
    medication_data["items"] *= 21
    assert (
        client_for(world.staff)
        .post(
            f"/api/v1/patients/{world.patient.id}/medication-plans", medication_data, format="json"
        )
        .status_code
        == 400
    )


def test_duplicate_prescriptions_at_same_instant_are_rejected_atomically(
    world, medication_data, client_for
):
    medication_data["items"].append(copy.deepcopy(medication_data["items"][0]))
    created = client_for(world.staff).post(
        f"/api/v1/patients/{world.patient.id}/medication-plans", medication_data, format="json"
    )
    grant_approval(world.doctor)
    result = client_for(world.doctor).post(
        f"/api/v1/medication-plans/{created.data['id']}/approve",
        versions(created.data),
        format="json",
    )
    assert result.status_code == 400 and not DoseOccurrence.objects.exists()


@pytest.mark.parametrize(("day", "clock"), [("2026-03-08", "02:30"), ("2026-11-01", "01:30")])
def test_dst_missing_or_ambiguous_local_time_requires_clarification(
    world, medication_data, client_for, day, clock
):
    medication_data["items"][0].update(
        start_date=day, end_date=day, timezone="America/New_York", local_times=[clock]
    )
    created = client_for(world.staff).post(
        f"/api/v1/patients/{world.patient.id}/medication-plans", medication_data, format="json"
    )
    grant_approval(world.doctor)
    result = client_for(world.doctor).post(
        f"/api/v1/medication-plans/{created.data['id']}/approve",
        versions(created.data),
        format="json",
    )
    assert result.status_code == 400 and not DoseOccurrence.objects.exists()


def test_draft_edit_detects_stale_lock_version(world, draft, medication_data, client_for):
    client = client_for(world.staff)
    url = f"/api/v1/medication-plans/{draft['id']}"
    payload = {**versions(draft), "items": medication_data["items"]}
    result = client.patch(url, payload, format="json")
    assert result.status_code == 200 and result.data["lock_version"] == 2
    assert result.data["version"] == 1
    assert client.patch(url, payload, format="json").status_code == 409


@freeze_time("2026-11-17 07:00:00")
def test_taken_record_is_patient_reported_and_retry_safe(world, draft, client_for, task):
    plan = approve(world, client_for, draft)
    occurrence = DoseOccurrence.objects.order_by("scheduled_at").first()
    payload = record_payload(occurrence)
    client = client_for(world.patient_user)
    url = f"/api/v1/dose-occurrences/{occurrence.id}/record"
    first = client.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY="offline-record")
    repeat = client.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY="offline-record")
    another = client.post(url, payload, format="json")
    assert first.status_code == repeat.status_code == 201 and another.status_code == 200
    assert DoseRecord.objects.count() == 1
    assert first.data["patient_reported"] is True and first.data["late_recorded"] is True
    assert first.data["sync_delay_seconds"] > 0
    assert client.post(url, record_payload(occurrence, "SKIPPED"), format="json").status_code == 409
    history = client_for(world.doctor).get(
        f"/api/v1/patients/{world.patient.id}/medication-history"
    )
    assert history.status_code == 200 and history.data["results"][0]["status"] == "TAKEN"
    task.refresh_from_db()
    assert task.status == "NEW"
    assert plan["status"] == "ACTIVE"


@freeze_time("2026-11-17 07:00:00")
def test_missing_record_never_becomes_skipped_or_completes_task(world, draft, client_for, task):
    plan = approve(world, client_for, draft)
    response = client_for(world.patient_user).get(
        f"/api/v1/medication-plans/{plan['id']}/occurrences"
    )
    assert response.data["results"][0]["status"] == "UNRECORDED"
    assert not DoseRecord.objects.exists()
    task.refresh_from_db()
    assert task.status == "NEW"


@freeze_time("2026-11-17 07:00:00")
def test_future_occurrence_and_bad_record_times_are_rejected(world, draft, client_for):
    approve(world, client_for, draft)
    first, last = DoseOccurrence.objects.first(), DoseOccurrence.objects.last()
    client = client_for(world.patient_user)
    assert (
        client.post(
            f"/api/v1/dose-occurrences/{last.id}/record", record_payload(last), format="json"
        ).status_code
        == 400
    )
    payload = record_payload(first)
    url = f"/api/v1/dose-occurrences/{first.id}/record"
    for changes in [
        {"reported_taken_at": (first.scheduled_at - timedelta(seconds=1)).isoformat()},
        {"client_recorded_at": (timezone.now() + timedelta(seconds=1)).isoformat()},
        {"reported_taken_at": (timezone.now() + timedelta(seconds=1)).isoformat()},
        {"result": "SKIPPED"},
        {"client_recorded_at": "2026-11-17T03:10:00"},
    ]:
        assert client.post(url, {**payload, **changes}, format="json").status_code == 400
    assert client.post(url, {**payload, "plan_version": 99}, format="json").status_code == 409
    assert not DoseRecord.objects.exists()


@freeze_time("2026-11-17 07:00:00")
def test_corrections_are_append_only_with_one_current_result(world, draft, client_for):
    approve(world, client_for, draft)
    occurrence = DoseOccurrence.objects.first()
    client = client_for(world.patient_user)
    original = client.post(
        f"/api/v1/dose-occurrences/{occurrence.id}/record",
        record_payload(occurrence),
        format="json",
    )
    url = f"/api/v1/dose-records/{original.data['id']}/corrections"
    payload = {**record_payload(occurrence, "SKIPPED"), "version": 1, "reason": "Sintetik tuzatish"}
    result = client.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY="correction-once")
    assert result.status_code == 200 and result.data["result"] == "SKIPPED"
    assert result.data["original"]["result"] == "TAKEN" and result.data["version"] == 2
    assert (
        client.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY="correction-once").status_code
        == 200
    )
    assert client.post(url, payload, format="json").status_code == 409
    assert DoseRecord.objects.get().result == "TAKEN" and DoseRecordCorrection.objects.count() == 1
    assert AuditEvent.objects.filter(
        action="DOSE_RECORD_CORRECTED", actor=world.patient_user
    ).exists()


@freeze_time("2026-11-17 07:00:00")
def test_stop_cancels_future_occurrences_and_keeps_late_offline_history(world, draft, client_for):
    plan = approve(world, client_for, draft)
    client = client_for(world.doctor)
    stopped = client.post(
        f"/api/v1/medication-plans/{plan['id']}/stop",
        {**versions(plan), "reason": "Sintetik stop"},
        format="json",
    )
    assert stopped.status_code == 200 and stopped.data["status"] == "STOPPED"
    assert DoseOccurrence.objects.filter(cancelled_at__isnull=False).count() == 3
    with freeze_time("2026-11-18 18:00:00"):
        occurrence = DoseOccurrence.objects.last()
        recorded = client_for(world.patient_user).post(
            f"/api/v1/dose-occurrences/{occurrence.id}/record",
            record_payload(occurrence),
            format="json",
        )
        assert recorded.status_code == 201 and recorded.data["recorded_against_inactive_plan"]
    assert MedicationPlan.objects.get().status == "STOPPED"


@freeze_time("2026-11-17 07:00:00")
def test_revision_needs_new_approval_and_preserves_past_records(world, draft, client_for):
    plan = approve(world, client_for, draft)
    original_occurrence = DoseOccurrence.objects.first()
    recorded = client_for(world.patient_user).post(
        f"/api/v1/dose-occurrences/{original_occurrence.id}/record",
        record_payload(original_occurrence),
        format="json",
    )
    assert recorded.status_code == 201
    doctor = client_for(world.doctor)
    url = f"/api/v1/medication-plans/{plan['id']}"
    revision = doctor.post(f"{url}/revisions", versions(plan), format="json")
    assert revision.status_code == 201 and revision.data["version"] == 2
    assert MedicationPlan.objects.get(pk=plan["id"]).status == "ACTIVE"
    assert DoseOccurrence.objects.filter(cancelled_at__isnull=False).count() == 0
    current = doctor.get(url).data
    assert doctor.post(f"{url}/revisions", versions(current), format="json").status_code == 409
    approved = doctor.post(
        f"/api/v1/medication-plans/{revision.data['id']}/approve",
        versions(revision.data),
        format="json",
    )
    assert approved.status_code == 200 and approved.data["status"] == "ACTIVE"
    assert MedicationPlan.objects.get(pk=plan["id"]).status == "STOPPED"
    assert DoseOccurrence.objects.filter(item__plan_id=revision.data["id"]).count() == 3
    assert DoseRecord.objects.get().occurrence_id == original_occurrence.pk
    assert (
        DoseOccurrence.objects.filter(item__plan_id=plan["id"], cancelled_at__isnull=False).count()
        == 3
    )


@freeze_time("2026-11-17 07:00:00")
def test_course_finishes_without_inventing_dose_records(world, draft, client_for):
    plan = approve(world, client_for, draft)
    with freeze_time("2026-11-19 00:00:00"):
        assert complete_courses() == 1
        assert complete_courses() == 0
    assert MedicationPlan.objects.get(pk=plan["id"]).status == "COMPLETED"
    assert not DoseRecord.objects.exists()


@freeze_time("2026-11-17 07:00:00")
def test_other_patient_admin_and_coordinator_cannot_read_medication_data(world, draft, client_for):
    plan = approve(world, client_for, draft)
    outsider_patient = Patient.objects.create(
        created_by=world.staff,
        created_by_org=world.hospital,
        full_name="Other synthetic patient",
        birth_date=date(1980, 1, 1),
        address="Synthetic",
        territory=world.territory,
        no_phone_reason="Synthetic",
    )
    other = User.objects.create_user(
        username="other.patient", role=Role.PATIENT, patient=outsider_patient
    )
    occurrence = DoseOccurrence.objects.first()
    for actor in [world.admin, world.outsider, other, world.doctor2]:
        client = client_for(actor)
        assert client.get(f"/api/v1/medication-plans/{plan['id']}").status_code == 404
        assert (
            client.get(f"/api/v1/patients/{world.patient.id}/medication-history").status_code == 404
        )
        assert client.post(
            f"/api/v1/dose-occurrences/{occurrence.id}/record",
            record_payload(occurrence),
            format="json",
        ).status_code in {403, 404}
    assert (
        client_for(world.doctor)
        .post(
            f"/api/v1/dose-occurrences/{occurrence.id}/record",
            record_payload(occurrence),
            format="json",
        )
        .status_code
        == 403
    )
    assert (
        client_for(world.staff)
        .get(f"/api/v1/patients/{world.patient.id}/medication-history")
        .status_code
        == 404
    )


@freeze_time("2026-11-17 07:00:00")
def test_medication_dose_does_not_answer_chat_or_complete_patronage(world, draft, client_for, task):
    conversation = ensure_conversation(world.patient.id)
    client_for(world.patient_user).post(
        f"/api/v1/conversations/{conversation.id}/messages",
        {"text": "Synthetic question"},
        format="json",
    )
    approve(world, client_for, draft)
    occurrence = DoseOccurrence.objects.first()
    client_for(world.patient_user).post(
        f"/api/v1/dose-occurrences/{occurrence.id}/record",
        record_payload(occurrence),
        format="json",
    )
    task.refresh_from_db()
    assert task.status == "NEW" and ResponseEpisode.objects.get().responded_at is None


def test_hospital_doctor_can_only_approve_own_discharge(world, medication_data, client_for):
    clinician = User.objects.create_user(
        username="hospital.doctor",
        role=Role.DOCTOR,
        organization=world.hospital,
        can_approve_medication_schedule=True,
    )
    other = User.objects.create_user(
        username="other.hospital.doctor",
        role=Role.DOCTOR,
        organization=world.hospital,
        can_approve_medication_schedule=True,
    )
    client = client_for(clinician)
    created = client.post(f"/api/v1/patients/{world.patient.id}/medication-plans", medication_data, format="json")
    assert created.status_code == 404
    ordinary = client.post("/api/v1/discharges", {}, format="json")
    assert ordinary.status_code == 403
    created = client_for(world.coordinator).post(f"/api/v1/patients/{world.patient.id}/medication-plans", medication_data, format="json")
    assert created.status_code == 201
    assert client_for(world.coordinator).post(f"/api/v1/medication-plans/{created.data['id']}/approve", versions(created.data), format="json").status_code == 403


@freeze_time("2026-11-17 07:00:00")
def test_permission_revocation_blocks_idempotency_replay(world, draft, client_for):
    grant_approval(world.doctor)
    client = client_for(world.doctor)
    url = f"/api/v1/medication-plans/{draft['id']}/approve"
    assert (
        client.post(
            url, versions(draft), format="json", HTTP_IDEMPOTENCY_KEY="approve-once"
        ).status_code
        == 200
    )
    world.doctor.can_approve_medication_schedule = False
    world.doctor.save()
    assert (
        client.post(
            url, versions(draft), format="json", HTTP_IDEMPOTENCY_KEY="approve-once"
        ).status_code
        == 403
    )


@pytest.mark.django_db(transaction=True)
@freeze_time("2026-11-17 07:00:00")
def test_parallel_approval_creates_occurrences_once(world, draft):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock test requires PostgreSQL.")
    grant_approval(world.doctor)

    def send(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(world.doctor)
            return client.post(
                f"/api/v1/medication-plans/{draft['id']}/approve", versions(draft), format="json"
            ).status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(send, range(2)))
    assert sorted(statuses) == [200, 409] and DoseOccurrence.objects.count() == 4


@pytest.mark.django_db(transaction=True)
@freeze_time("2026-11-17 07:00:00")
def test_parallel_offline_sync_creates_one_dose_record(world, draft, client_for):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock test requires PostgreSQL.")
    approve(world, client_for, draft)
    occurrence = DoseOccurrence.objects.first()
    payload = record_payload(occurrence)

    def send(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(world.patient_user)
            return client.post(
                f"/api/v1/dose-occurrences/{occurrence.id}/record", payload, format="json"
            ).status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(send, range(2)))
    assert sorted(statuses) == [200, 201] and DoseRecord.objects.count() == 1


@freeze_time("2026-11-17 07:00:00")
def test_reassigned_doctor_loses_medication_access(world, draft, client_for, task):
    plan = approve(world, client_for, draft)
    reassigned = client_for(world.coordinator).post(
        f"/api/v1/tasks/{task.id}/reassign",
        {"version": 1, "doctor_id": str(world.doctor2.id), "reason": "Synthetic"},
        format="json",
    )
    assert reassigned.status_code == 200
    assert client_for(world.doctor).get(f"/api/v1/medication-plans/{plan['id']}").status_code == 404
    assert (
        client_for(world.doctor2).get(f"/api/v1/medication-plans/{plan['id']}").status_code == 200
    )
    assert (
        client_for(world.doctor)
        .get(f"/api/v1/patients/{world.patient.id}/medication-history")
        .status_code
        == 404
    )


@freeze_time("2026-11-17 07:00:00")
def test_dates_are_filtered_in_prescribed_timezone_not_utc(world, medication_data, client_for):
    medication_data["items"][0].update(local_times=["00:30"])
    response = client_for(world.staff).post(
        f"/api/v1/patients/{world.patient.id}/medication-plans", medication_data, format="json"
    )
    plan = approve(world, client_for, response.data)
    result = client_for(world.patient_user).get(
        f"/api/v1/medication-plans/{plan['id']}/occurrences",
        {"date_from": "2026-11-17", "date_to": "2026-11-17"},
    )
    assert result.data["count"] == 1
    assert result.data["results"][0]["scheduled_at"].startswith("2026-11-16T19:30:")


@pytest.mark.django_db(transaction=True)
@freeze_time("2026-11-17 07:00:00")
def test_stop_racing_revision_approval_has_one_winner(world, draft, client_for):
    if connection.vendor != "postgresql":
        pytest.skip("Row-lock test requires PostgreSQL.")
    plan = approve(world, client_for, draft)
    client = client_for(world.doctor)
    old_url = f"/api/v1/medication-plans/{plan['id']}"
    revision = client.post(f"{old_url}/revisions", versions(plan), format="json").data
    old_version = versions(client.get(old_url).data)

    def send(action):
        close_old_connections()
        try:
            sender = APIClient()
            sender.force_authenticate(world.doctor)
            if action == "stop":
                return sender.post(
                    f"{old_url}/stop", {**old_version, "reason": "Synthetic"}, format="json"
                ).status_code
            return sender.post(
                f"/api/v1/medication-plans/{revision['id']}/approve",
                versions(revision),
                format="json",
            ).status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(send, ["stop", "approve"]))
    assert sorted(statuses) == [200, 409]
    assert MedicationPlan.objects.filter(status="ACTIVE").count() <= 1
