import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from care.jobs import deliver_outbox
from care.models import AIExtraction, Notification, Organization
from messaging.models import Message, WorkSchedule
from messaging.services import ensure_conversation

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("actor", "organization_type"), [("staff", "HOSPITAL"), ("doctor", "CLINIC"), ("admin", None)]
)
def test_profile_exposes_organization_type_for_workspace_routing(
    world, client_for, actor, organization_type
):
    response = client_for(getattr(world, actor)).get("/api/v1/me")
    assert response.status_code == 200
    assert response.data["organization_type"] == organization_type


@pytest.mark.parametrize("change", ["doctor_inactive", "clinic_inactive", "assignment_ended"])
def test_patient_cannot_post_to_stale_assignee_until_conversation_refresh(
    world, client_for, change
):
    conversation = ensure_conversation(world.patient.id)
    if change == "doctor_inactive":
        world.doctor.is_active = False
        world.doctor.save(update_fields=["is_active"])
    elif change == "clinic_inactive":
        world.clinic.active = False
        world.clinic.save(update_fields=["active"])
    else:
        world.assignment.valid_to = timezone.now()
        world.assignment.save(update_fields=["valid_to"])
    client = client_for(world.patient_user)
    stale = client.post(
        f"/api/v1/conversations/{conversation.id}/messages",
        {"text": "Synthetic message"},
        format="json",
    )
    assert stale.status_code == 409
    assert not Message.objects.exists()
    refreshed = client.get("/api/v1/conversations")
    current = next(row for row in refreshed.data["results"] if row["status"] == "OPEN")
    assert current["id"] != str(conversation.id) and current["doctor"] is None
    queued = client.post(
        f"/api/v1/conversations/{current['id']}/messages",
        {"text": "Synthetic queued message"},
        format="json",
    )
    assert queued.status_code == 201
    assert Message.objects.count() == 1


def test_two_schedule_editors_cannot_silently_overwrite_each_other(world, client_for):
    first_client = client_for(world.coordinator)
    second_client = client_for(world.coordinator)
    url = f"/api/v1/doctors/{world.doctor.id}/work-schedule"
    first_version = first_client.get(url).data["version"]
    second_version = second_client.get(url).data["version"]
    first_payload = {
        "version": first_version,
        "timezone": "Asia/Tashkent",
        "shifts": [{"weekday": 0, "start": "09:00", "end": "12:00"}],
        "exceptions": {},
    }
    second_payload = {
        **first_payload,
        "version": second_version,
        "shifts": [{"weekday": 1, "start": "13:00", "end": "17:00"}],
    }
    saved = first_client.put(url, first_payload, format="json")
    assert saved.status_code == 200 and saved.data["version"] == first_version + 1
    conflict = second_client.put(url, second_payload, format="json")
    assert conflict.status_code == 409
    assert WorkSchedule.objects.get(doctor=world.doctor).shifts == first_payload["shifts"]


def test_new_schedule_requires_zero_version_and_missing_version_is_rejected(world, client_for):
    client = client_for(world.coordinator)
    url = f"/api/v1/doctors/{world.doctor2.id}/work-schedule"
    payload = {
        "timezone": "Asia/Tashkent",
        "shifts": [{"weekday": 0, "start": "09:00", "end": "18:00"}],
        "exceptions": {},
    }
    assert client.put(url, payload, format="json").status_code == 400
    assert client.put(url, {**payload, "version": 1}, format="json").status_code == 409
    created = client.put(
        url, {**payload, "version": 0}, format="json", HTTP_IDEMPOTENCY_KEY="schedule-create-once"
    )
    assert created.status_code == 200 and created.data["version"] == 1
    replay = client.put(
        url, {**payload, "version": 0}, format="json", HTTP_IDEMPOTENCY_KEY="schedule-create-once"
    )
    assert replay.status_code == 200 and replay.data["version"] == 1
    assert WorkSchedule.objects.filter(doctor=world.doctor2).count() == 1


def test_hospital_transfer_revokes_ai_extraction_read_and_review(world, client_for):
    extraction = AIExtraction.objects.create(
        discharge=world.discharge,
        status="PENDING_REVIEW",
        structured_result={"summary": "Synthetic clinical text"},
    )
    client = client_for(world.staff)
    url = f"/api/v1/ai-extractions/{extraction.id}"
    assert client.get(url).status_code == 200
    world.staff.organization = world.other_hospital
    world.staff.save(update_fields=["organization"])
    assert client.get(f"/api/v1/discharges/{world.discharge.id}").status_code == 404
    assert client.get(url).status_code == 404
    review = {
        "summary": "Synthetic revised text",
        "diagnosis_text": None,
        "recommendations": [],
        "follow_up_text": None,
    }
    assert client.post(f"{url}/review", review, format="json").status_code == 404
    extraction.refresh_from_db()
    assert extraction.status == "PENDING_REVIEW"


def test_doctor_transfer_revokes_old_clinic_task_patient_and_discharge_access(
    world, task, client_for
):
    client = client_for(world.doctor)
    assert client.get(f"/api/v1/tasks/{task.id}").status_code == 200
    other_clinic = Organization.objects.create(
        name="Other synthetic clinic", type="CLINIC", territory=world.other_territory
    )
    world.doctor.organization = other_clinic
    world.doctor.save(update_fields=["organization"])
    assert client.get(f"/api/v1/tasks/{task.id}").status_code == 404
    assert client.get(f"/api/v1/patients/{world.patient.id}").status_code == 404
    assert client.get(f"/api/v1/discharges/{world.discharge.id}").status_code == 404
    assert (
        client.post(
            f"/api/v1/tasks/{task.id}/accept", {"version": task.version}, format="json"
        ).status_code
        == 404
    )


def test_outbox_suppresses_task_notifications_after_clinic_transfer(world, task):
    other_clinic = Organization.objects.create(
        name="Other notification clinic", type="CLINIC", territory=world.other_territory
    )
    world.doctor.organization = other_clinic
    world.doctor.save(update_fields=["organization"])
    deliver_outbox()
    assert not Notification.objects.filter(recipient=world.doctor, task=task).exists()


def test_restore_refresh_requests_do_not_consume_login_budget(world):
    client = APIClient()
    for _ in range(10):
        assert client.post("/api/v1/auth/refresh", {}, format="json").status_code == 401
    response = client.post(
        "/api/v1/auth/login",
        {"username": "staff", "password": "Test-example-927!", "client": "android"},
        format="json",
    )
    assert response.status_code == 200


def test_refresh_remains_rate_limited_in_its_own_budget(world):
    client = APIClient()
    for _ in range(60):
        assert client.post("/api/v1/auth/refresh", {}, format="json").status_code == 401
    assert client.post("/api/v1/auth/refresh", {}, format="json").status_code == 429
