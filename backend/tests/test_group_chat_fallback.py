from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import uuid4

import pytest
from django.db import close_old_connections, connection, connections
from django.urls import get_resolver
from django.utils import timezone
from freezegun import freeze_time

from accounts.models import AuthSession, Role, User
from accounts.presence import online_doctor_ids
from care.models import AuditEvent, OutboxEvent
from messaging.assistant import release_pending_assessment
from messaging.groups import change_team
from messaging.jobs import release_assistant_replies
from messaging.models import (
    AssistantAssessment,
    ChatDoctorMembership,
    EmergencyIncident,
    Message,
    ResponseEpisode,
)
from messaging.services import change_assignment, ensure_conversation


@pytest.fixture
def chat_world(world, client_for, settings):
    # Import DRF throttles before freezing time; its class timer must retain its builtin clock.
    get_resolver().resolve("/api/v1/conversations")
    settings.DEMO_MODE = True
    settings.ASSISTANT_MODE = "demo"
    conversation = ensure_conversation(world.patient.pk)
    return world, conversation, client_for(world.patient_user)


def online(doctor):
    return AuthSession.objects.create(
        user=doctor,
        client="web",
        current_jti=uuid4().hex,
        expires_at=timezone.now() + timedelta(days=1),
        last_seen_at=timezone.now(),
    )


def send(client, conversation, text, key=None):
    return client.post(
        f"/api/v1/conversations/{conversation.pk}/messages",
        {"text": text},
        format="json",
        HTTP_IDEMPOTENCY_KEY=key or uuid4().hex,
    )


@pytest.mark.django_db
def test_one_online_team_doctor_defers_ai_until_exactly_sixty_seconds(chat_world):
    world, conversation, patient = chat_world
    with freeze_time("2026-11-18 10:00:00") as clock:
        session = online(world.doctor)
        response = send(patient, conversation, "Boshim og‘riyapti")
        assert response.status_code == 201
        assert response.data["assistant"] is None and response.data["assistant_status"] == "WAITING"
        due = AssistantAssessment.objects.get().reply_due_at
        assert due == timezone.now() + timedelta(seconds=60)
        clock.tick(59)
        AuthSession.objects.filter(pk=session.pk).update(last_seen_at=timezone.now())
        assert release_assistant_replies() == 0
        clock.tick(1)
        assert release_assistant_replies() == 1
        row = AssistantAssessment.objects.get()
        assert row.reply_at == due and row.reply_reason == "NO_REPLY_60S"
        assert row.message.response_episode.responded_at is None
        assert release_assistant_replies() == 0
        assert OutboxEvent.objects.filter(event_type="AI_ASSISTANT_REPLY").count() == 1
        message = patient.get(f"/api/v1/conversations/{conversation.pk}/messages").data["results"][
            0
        ]
        assert message["assistant"]["reply_reason"] == "NO_REPLY_60S"


@pytest.mark.django_db
def test_second_team_doctor_online_is_enough_and_his_reply_cancels_pending_ai(
    chat_world, client_for
):
    world, conversation, patient = chat_world
    change_team(world.coordinator, world.patient.pk, world.doctor2.pk, "ADD")
    with freeze_time("2026-11-18 10:00:00") as clock:
        online(world.doctor2)
        response = send(patient, conversation, "Boshim og‘riyapti")
        assert response.data["assistant"] is None
        clock.tick(30)
        doctor = client_for(world.doctor2)
        reply = send(doctor, conversation, "Jamoa shifokorining javobi")
        assert reply.status_code == 201 and reply.data["sender_name"] == world.doctor2.username
        assert reply.data["assistant"] is None
        clock.tick(60)
        assert release_assistant_replies() == 0
        assessment = AssistantAssessment.objects.get()
        assert assessment.suppressed_at and not assessment.reply_at
        assert assessment.reply_reason == "DOCTOR_REPLIED"
        assert ResponseEpisode.objects.get().responded_at
        assert not OutboxEvent.objects.filter(event_type="AI_ASSISTANT_REPLY").exists()
        assert (
            OutboxEvent.objects.filter(event_type="CHAT_MESSAGE", recipient=world.doctor).count()
            == 2
        )


@pytest.mark.django_db
def test_all_doctors_offline_releases_pending_reply_before_deadline(chat_world):
    world, conversation, patient = chat_world
    session = online(world.doctor)
    assert send(patient, conversation, "Savolim bor").data["assistant"] is None
    AuthSession.objects.filter(pk=session.pk).update(last_seen_at=None)
    assert release_assistant_replies() == 1
    assert AssistantAssessment.objects.get().reply_reason == "DOCTORS_OFFLINE"


@pytest.mark.django_db
def test_messages_while_waiting_do_not_restart_timer_or_create_multiple_ai_replies(chat_world):
    world, conversation, patient = chat_world
    with freeze_time("2026-11-18 10:00:00") as clock:
        session = online(world.doctor)
        first = send(patient, conversation, "Boshim og‘riyapti")
        due = AssistantAssessment.objects.get().reply_due_at
        clock.tick(20)
        second = send(patient, conversation, "2 soatdan beri, kuchaymoqda")
        assert first.data["id"] != second.data["id"]
        assert AssistantAssessment.objects.get(message_id=second.data["id"]).reply_due_at == due
        assert AssistantAssessment.objects.get(message_id=first.data["id"]).suppressed_at
        clock.tick(40)
        AuthSession.objects.filter(pk=session.pk).update(last_seen_at=timezone.now())
        assert release_assistant_replies() == 1
        latest = AssistantAssessment.objects.get(message_id=second.data["id"])
        assert latest.context["topic"] == "headache"
        assert AssistantAssessment.objects.filter(reply_at__isnull=False).count() == 1


@pytest.mark.django_db
def test_emergency_never_waits_for_online_doctors_and_alerts_entire_team(chat_world, client_for):
    world, conversation, patient = chat_world
    change_team(world.doctor, world.patient.pk, world.doctor2.pk, "ADD")
    online(world.doctor)
    online(world.doctor2)
    response = send(patient, conversation, "Nafas ololmayapman")
    assert response.data["assistant"]["risk"] == "EMERGENCY"
    assert response.data["assistant"]["reply_reason"] == "EMERGENCY"
    assert EmergencyIncident.objects.count() == 1
    assert set(
        OutboxEvent.objects.filter(event_type="AI_EMERGENCY_ALERT").values_list(
            "recipient_id", flat=True
        )
    ) >= {world.doctor.pk, world.doctor2.pk, world.coordinator.pk}
    incident_id = response.data["assistant"]["emergency"]["id"]
    url = f"/api/v1/assistant/emergencies/{incident_id}"
    peer = client_for(world.doctor2)
    assert peer.get(url).status_code == 200
    assert (
        peer.post(
            url + "/acknowledge", {}, format="json", HTTP_IDEMPOTENCY_KEY="group-ack"
        ).status_code
        == 200
    )
    change_team(world.doctor, world.patient.pk, world.doctor2.pk, "REMOVE")
    assert (
        peer.post(
            url + "/acknowledge", {}, format="json", HTTP_IDEMPOTENCY_KEY="group-ack"
        ).status_code
        == 404
    )


@pytest.mark.django_db
def test_read_receipt_does_not_cancel_delayed_ai(chat_world, client_for):
    world, conversation, patient = chat_world
    with freeze_time("2026-11-18 10:00:00") as clock:
        session = online(world.doctor)
        send(patient, conversation, "Shifokorga savolim bor")
        assert (
            client_for(world.doctor)
            .post(f"/api/v1/conversations/{conversation.pk}/read", {}, format="json")
            .status_code
            == 200
        )
        assert Message.objects.get().read_at and not ResponseEpisode.objects.get().responded_at
        clock.tick(60)
        AuthSession.objects.filter(pk=session.pk).update(last_seen_at=timezone.now())
        assert release_assistant_replies() == 1
        assert AssistantAssessment.objects.get().reply_reason == "NO_REPLY_60S"


@pytest.mark.django_db
def test_removed_online_doctor_does_not_block_fallback(chat_world):
    world, conversation, patient = chat_world
    change_team(world.doctor, world.patient.pk, world.doctor2.pk, "ADD")
    online(world.doctor2)
    assert send(patient, conversation, "Shifokorga savolim bor").data["assistant"] is None
    change_team(world.doctor, world.patient.pk, world.doctor2.pk, "REMOVE")
    assert release_assistant_replies() == 1
    assert AssistantAssessment.objects.get().reply_reason == "DOCTORS_OFFLINE"


@pytest.mark.django_db
def test_team_membership_is_explicit_scoped_and_revocable_on_idempotent_replay(
    chat_world, client_for
):
    world, conversation, patient = chat_world
    url = f"/api/v1/patients/{world.patient.pk}/chat-doctors"
    base = f"/api/v1/conversations/{conversation.pk}"
    assert client_for(world.doctor2).get(base).status_code == 404
    assert (
        patient.post(
            url, {"doctor": str(world.doctor2.pk), "action": "ADD"}, format="json"
        ).status_code
        == 403
    )
    assert client_for(world.outsider).get(url).status_code == 404
    assert client_for(world.admin).get(url).status_code == 404
    added = client_for(world.doctor).post(
        url,
        {"doctor": str(world.doctor2.pk), "action": "ADD"},
        format="json",
        HTTP_IDEMPOTENCY_KEY="add-doctor",
    )
    assert added.status_code == 200
    assert {member["id"] for member in added.data["members"]} == {
        str(world.doctor.pk),
        str(world.doctor2.pk),
    }
    assert ChatDoctorMembership.objects.count() == 1
    other = User.objects.create_user(
        username="other-territory-doctor", role=Role.DOCTOR, organization=world.other_hospital
    )
    assert (
        client_for(world.coordinator)
        .post(url, {"doctor": str(other.pk), "action": "ADD"}, format="json")
        .status_code
        == 404
    )
    doctor2 = client_for(world.doctor2)
    assert doctor2.get(base).status_code == 200
    assert doctor2.get(url).data["can_manage"] is False
    assert (
        doctor2.post(
            url, {"doctor": str(world.doctor.pk), "action": "REMOVE"}, format="json"
        ).status_code
        == 403
    )
    # Membership grants chat access, not unrelated medical/task privileges.
    assert doctor2.get(f"/api/v1/patients/{world.patient.pk}").status_code == 404
    sent = send(doctor2, conversation, "Guruhdagi javob", "reply-once")
    assert sent.status_code == 201
    assert (
        client_for(world.coordinator)
        .post(url, {"doctor": str(world.doctor2.pk), "action": "REMOVE"}, format="json")
        .status_code
        == 200
    )
    assert doctor2.get(base + "/messages").status_code == 404
    assert send(doctor2, conversation, "Guruhdagi javob", "reply-once").status_code == 404
    assert Message.objects.count() == 1


@pytest.mark.django_db
def test_carried_unanswered_message_and_fallback_reach_new_primary_doctor(chat_world, client_for):
    world, conversation, patient = chat_world
    online(world.doctor)
    first = send(patient, conversation, "Boshim og‘riyapti")
    current = change_assignment(world.patient.pk, world.doctor2)
    assert current.pk != conversation.pk
    assert release_assistant_replies() == 1
    rows = client_for(world.doctor2).get(f"/api/v1/conversations/{current.pk}/messages")
    assert rows.status_code == 200 and rows.data["results"][0]["id"] == first.data["id"]
    assert rows.data["results"][0]["assistant"]["reply_reason"] == "DOCTORS_OFFLINE"
    assert client_for(world.doctor).get(f"/api/v1/conversations/{current.pk}").status_code == 404


@pytest.mark.django_db
def test_presence_ttl_expiry_revocation_and_multiple_sessions(chat_world):
    world, conversation, patient = chat_world
    with freeze_time("2026-11-18 10:00:00") as clock:
        first, second = online(world.doctor), online(world.doctor)
        AuthSession.objects.filter(pk=first.pk).update(revoked_at=timezone.now())
        assert online_doctor_ids([world.doctor.pk]) == {world.doctor.pk}
        clock.tick(46)
        assert not online_doctor_ids([world.doctor.pk])
        AuthSession.objects.filter(pk=second.pk).update(
            last_seen_at=timezone.now(), expires_at=timezone.now() - timedelta(seconds=1)
        )
        assert not online_doctor_ids([world.doctor.pk])


@pytest.mark.django_db
def test_foreground_presence_endpoint_uses_only_authenticated_session(world, client_for):
    client = client_for(world.doctor)
    client.force_authenticate(user=None)
    login = client.post(
        "/api/v1/auth/login",
        {"username": "doctor", "password": "Test-example-927!", "client": "android"},
        format="json",
    )
    assert login.status_code == 200
    client.credentials(HTTP_AUTHORIZATION="Bearer " + login.data["access"])
    assert client.post("/api/v1/me/presence", {"active": False}, format="json").status_code == 200
    assert not online_doctor_ids([world.doctor.pk])
    assert (
        client.post(
            "/api/v1/me/presence", {"active": True, "doctor": str(world.doctor2.pk)}, format="json"
        ).status_code
        == 200
    )
    assert online_doctor_ids([world.doctor.pk, world.doctor2.pk]) == {world.doctor.pk}
    assert (
        client_for(world.patient_user)
        .post("/api/v1/me/presence", {"active": True}, format="json")
        .status_code
        == 403
    )


@pytest.mark.django_db(transaction=True)
def test_parallel_fallback_workers_publish_once(chat_world):
    if connection.vendor != "postgresql":
        pytest.skip("Concurrent row locks require PostgreSQL.")
    world, conversation, patient = chat_world
    session = online(world.doctor)
    send(patient, conversation, "Savolim bor")
    pk = AssistantAssessment.objects.get().pk
    AuthSession.objects.filter(pk=session.pk).update(last_seen_at=None)

    def release(_):
        close_old_connections()
        try:
            return release_pending_assessment(pk)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(release, range(2))) == [False, True]
    assert OutboxEvent.objects.filter(event_type="AI_ASSISTANT_REPLY").count() == 1
    assert AuditEvent.objects.filter(action="DEMO_ASSISTANT_REPLY_PUBLISHED").count() == 1
