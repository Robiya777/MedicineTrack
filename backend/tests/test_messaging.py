from datetime import UTC, datetime, timedelta

import pytest
from django.utils import timezone
from freezegun import freeze_time

from care.jobs import deliver_outbox
from care.models import Notification, OutboxEvent
from messaging.calendar import response_deadline
from messaging.jobs import scan_responses
from messaging.models import Message, ResponseEpisode, WorkSchedule
from messaging.services import ensure_conversation

pytestmark = pytest.mark.django_db


def test_calendar_counts_work_hours_and_holidays():
    schedule = {
        "timezone": "Asia/Tashkent",
        "shifts": [{"weekday": day, "start": "09:00", "end": "18:00"} for day in range(5)],
        "exceptions": {"2026-11-18": []},
    }
    # Tuesday 22:00 local -> Thursday 13:00 local (Wednesday is an exception).
    start = datetime(2026, 11, 17, 17, tzinfo=UTC)
    assert response_deadline(start, schedule) == datetime(2026, 11, 19, 8, tzinfo=UTC)


def test_calendar_preserves_lunch_breaks():
    schedule = {
        "timezone": "Asia/Tashkent",
        "shifts": [
            {"weekday": 1, "start": "09:00", "end": "12:00"},
            {"weekday": 1, "start": "13:00", "end": "18:00"},
        ],
        "exceptions": {},
    }
    start = datetime(2026, 11, 17, 6, tzinfo=UTC)  # 11:00 local
    assert response_deadline(start, schedule) == datetime(
        2026, 11, 17, 11, tzinfo=UTC
    )  # 16:00 local


def test_messages_idempotent_and_other_patients_denied(world, client_for):
    conversation = ensure_conversation(world.patient.id)
    client = client_for(world.patient_user)
    url = f"/api/v1/conversations/{conversation.id}/messages"
    for _ in range(2):
        response = client.post(
            url, {"text": "Synthetic message"}, format="json", HTTP_IDEMPOTENCY_KEY="message-once"
        )
        assert response.status_code == 201
    assert Message.objects.count() == 1
    assert client_for(world.doctor).get(url).data["count"] == 1
    assert client_for(world.outsider).get(url).status_code == 404
    assert client_for(world.coordinator).get(url).status_code == 404
    other_patient = type(world.patient_user).objects.create_user(
        username="unrelated", role="PATIENT"
    )
    assert client_for(other_patient).get(url).status_code == 404


def test_read_does_not_complete_task_or_answer_episode(world, task, client_for):
    conversation = ensure_conversation(world.patient.id)
    base = f"/api/v1/conversations/{conversation.id}"
    client_for(world.patient_user).post(
        f"{base}/messages", {"text": "Synthetic message"}, format="json"
    )
    read = client_for(world.doctor).post(f"{base}/read", {}, format="json")
    assert read.status_code == 200 and read.data["marked_read"] == 1
    assert Message.objects.get().read_at is not None
    assert ResponseEpisode.objects.get().responded_at is None
    task.refresh_from_db()
    assert task.status == "NEW"


def test_unanswered_period_not_extended_by_more_messages(world, client_for):
    conversation = ensure_conversation(world.patient.id)
    client = client_for(world.patient_user)
    url = f"/api/v1/conversations/{conversation.id}/messages"
    with freeze_time("2026-11-17 05:00:00"):
        client.post(url, {"text": "First"}, format="json")
    episode = ResponseEpisode.objects.get()
    original_due = episode.response_due_at
    with freeze_time("2026-11-17 06:00:00"):
        client.post(url, {"text": "Second"}, format="json")
    episode.refresh_from_db()
    assert episode.response_due_at == original_due
    with freeze_time(original_due + timedelta(seconds=1)):
        scan_responses()
        scan_responses()
    assert OutboxEvent.objects.filter(event_type="RESPONSE_OVERDUE", recipient=world.coordinator).count() == 1
    response = client_for(world.coordinator).get("/api/v1/dashboard/unanswered")
    assert response.data["count"] == 1
    assert "text" not in response.data["results"][0]


def test_doctor_reply_closes_episode_and_next_message_starts_new_one(world, client_for):
    conversation = ensure_conversation(world.patient.id)
    url = f"/api/v1/conversations/{conversation.id}/messages"
    patient = client_for(world.patient_user)
    patient.post(url, {"text": "Question"}, format="json")
    assert (
        client_for(world.doctor).post(url, {"text": "Synthetic reply"}, format="json").status_code
        == 201
    )
    assert ResponseEpisode.objects.get().responded_at is not None
    patient.post(url, {"text": "Next question"}, format="json")
    assert ResponseEpisode.objects.count() == 2
    assert ResponseEpisode.objects.filter(responded_at__isnull=True).count() == 1


def test_reassign_transfers_original_deadline_and_closes_old_conversation(world, task, client_for):
    conversation = ensure_conversation(world.patient.id)
    base = f"/api/v1/conversations/{conversation.id}"
    client_for(world.patient_user).post(f"{base}/messages", {"text": "Question"}, format="json")
    original_due = ResponseEpisode.objects.get().response_due_at
    response = client_for(world.coordinator).post(
        f"/api/v1/tasks/{task.id}/reassign",
        {"version": 1, "doctor_id": str(world.doctor2.id), "reason": "Synthetic"},
        format="json",
    )
    assert response.status_code == 200
    current = ensure_conversation(world.patient.id)
    episode = ResponseEpisode.objects.get()
    assert current.pk != conversation.pk
    assert episode.conversation_id == current.pk and episode.response_due_at == original_due
    assert client_for(world.doctor).get(f"{base}/messages").status_code == 404
    assert client_for(world.doctor2).get(f"{base}/messages").status_code == 404
    assert client_for(world.patient_user).get(f"{base}/messages").status_code == 200
    assert (
        client_for(world.patient_user)
        .post(f"{base}/messages", {"text": "Closed"}, format="json")
        .status_code
        == 409
    )


def test_worsened_status_is_self_reported_and_escalated(world, client_for):
    conversation = ensure_conversation(world.patient.id)
    url = f"/api/v1/conversations/{conversation.id}/status-updates"
    payload = {
        "self_reported_state": "WORSENED",
        "note": "Synthetic status",
        "observed_at": timezone.now().isoformat(),
    }
    response = client_for(world.patient_user).post(url, payload, format="json")
    assert response.status_code == 201 and response.data["patient_reported"] is True
    assert OutboxEvent.objects.filter(event_type="PATIENT_WORSENED", recipient=world.coordinator).count() == 1
    deliver_outbox()
    assert Notification.objects.filter(event_type="PATIENT_WORSENED", recipient=world.coordinator).count() == 1
    assert client_for(world.doctor).get(url).data["count"] == 1
    assert client_for(world.doctor).post(url, payload, format="json").status_code == 403


def test_no_doctor_keeps_message_in_safe_queue(world, client_for):
    world.assignment.valid_to = timezone.now()
    world.assignment.save()
    conversation = ensure_conversation(world.patient.id)
    url = f"/api/v1/conversations/{conversation.id}/messages"
    assert (
        client_for(world.patient_user).post(url, {"text": "Queued"}, format="json").status_code
        == 201
    )
    assert conversation.doctor_id is None
    assert client_for(world.doctor).get(url).status_code == 404
    assert ResponseEpisode.objects.get().response_due_at is None
    assert OutboxEvent.objects.filter(event_type="RESPONSE_SCHEDULE_MISSING").exists()


def test_completed_task_does_not_close_chat(world, task, client_for):
    task.status = "COMPLETED"
    task.completed_at = timezone.now()
    task.save()
    conversation = ensure_conversation(world.patient.id)
    response = client_for(world.patient_user).post(
        f"/api/v1/conversations/{conversation.id}/messages",
        {"text": "After completion"},
        format="json",
    )
    assert response.status_code == 201


def test_schedule_changes_preserve_existing_episode_deadline(world, client_for):
    conversation = ensure_conversation(world.patient.id)
    client_for(world.patient_user).post(
        f"/api/v1/conversations/{conversation.id}/messages", {"text": "Question"}, format="json"
    )
    episode = ResponseEpisode.objects.get()
    old_due, old_snapshot = episode.response_due_at, episode.schedule_snapshot
    url = f"/api/v1/doctors/{world.doctor.id}/work-schedule"
    response = client_for(world.coordinator).put(
        url,
        {
            "timezone": "Asia/Tashkent",
            "shifts": [{"weekday": 1, "start": "10:00", "end": "12:00"}],
            "exceptions": {},
        },
        format="json",
    )
    assert response.status_code == 200 and response.data["version"] == 2
    episode.refresh_from_db()
    assert episode.response_due_at == old_due and episode.schedule_snapshot == old_snapshot


def test_invalid_overlapping_schedule_is_rejected(world, client_for):
    response = client_for(world.coordinator).put(
        f"/api/v1/doctors/{world.doctor.id}/work-schedule",
        {
            "timezone": "Asia/Tashkent",
            "shifts": [
                {"weekday": 0, "start": "09:00", "end": "12:00"},
                {"weekday": 0, "start": "11:00", "end": "14:00"},
            ],
            "exceptions": {},
        },
        format="json",
    )
    assert response.status_code == 400
    assert WorkSchedule.objects.get(doctor=world.doctor).version == 1


def test_doctor_reactivation_creates_new_conversation_without_reusing_old_chat(world):
    original = ensure_conversation(world.patient.id)
    world.doctor.is_active = False
    world.doctor.save()
    waiting = ensure_conversation(world.patient.id)
    assert waiting.doctor_id is None and waiting.id != original.id
    world.doctor.is_active = True
    world.doctor.save()
    restored = ensure_conversation(world.patient.id)
    assert restored.id not in {original.id, waiting.id}
    assert restored.assignment_id == world.assignment.id


def test_mismatched_doctor_organization_cannot_keep_chat_access(world, client_for):
    conversation = ensure_conversation(world.patient.id)
    world.doctor.organization = world.other_hospital
    world.doctor.save()
    assert (
        client_for(world.doctor)
        .get(f"/api/v1/conversations/{conversation.id}/messages")
        .status_code
        == 404
    )
