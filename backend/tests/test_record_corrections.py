import pytest
from django.utils import timezone

from accounts.models import Role, User
from care.models import AuditEvent, RecordCorrection

pytestmark = pytest.mark.django_db


def test_discharge_correction_preserves_original_and_replays(world, task, client_for):
    client = client_for(world.staff)
    url = f"/api/v1/discharges/{world.discharge.id}/corrections"
    original = world.discharge.recommendations
    payload = {
        "field": "recommendations",
        "correction_text": "Corrected advice",
        "reason": "Source clarified",
    }
    first = client.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY="correction-once")
    again = client.post(url, payload, format="json", HTTP_IDEMPOTENCY_KEY="correction-once")
    assert first.status_code == again.status_code == 201
    assert first.data["id"] == again.data["id"]
    assert again["Idempotency-Replayed"] == "true"
    world.discharge.refresh_from_db()
    assert world.discharge.recommendations == original
    assert RecordCorrection.objects.count() == 1
    assert AuditEvent.objects.filter(action="DISCHARGE_CORRECTED").count() == 1
    view = client_for(world.patient_user).get(f"/api/v1/tasks/{task.id}")
    assert view.data["recommendations"] == original and len(view.data["corrections"]) == 1
    assert client_for(world.patient_user).post(url, payload, format="json").status_code == 403


def test_report_correction_requires_author_and_reason(world, task, client_for):
    client = client_for(world.doctor)
    base = f"/api/v1/tasks/{task.id}"
    accepted = client.post(f"{base}/accept", {"version": 1}, format="json")
    completed = client.post(
        f"{base}/complete",
        {
            "version": accepted.data["version"],
            "performed_at": timezone.now().isoformat(),
            "channel": "HOME_VISIT",
            "observation": "Original observation",
            "actions": "Original actions",
            "follow_up": "Original follow-up",
        },
        format="json",
    )
    assert completed.status_code == 200
    payload = {
        "field": "observation",
        "correction_text": "Clarified observation",
        "reason": "Typing error",
    }
    assert client.post(f"{base}/report-corrections", payload, format="json").status_code == 201
    task.refresh_from_db()
    assert task.report.observation == "Original observation"
    assert AuditEvent.objects.filter(action="REPORT_CORRECTED").count() == 1
    assert (
        client_for(world.doctor2)
        .post(f"{base}/report-corrections", payload, format="json")
        .status_code
        == 404
    )
    assert (
        client_for(world.coordinator)
        .post(f"{base}/report-corrections", payload, format="json")
        .status_code
        == 403
    )
    assert (
        client.post(
            f"{base}/report-corrections", {**payload, "reason": ""}, format="json"
        ).status_code
        == 400
    )
    assert (
        client.post(
            f"{base}/report-corrections", {**payload, "field": "status"}, format="json"
        ).status_code
        == 400
    )
    assert RecordCorrection.objects.count() == 1


def test_contact_edit_requires_own_organization_draft_and_is_audited(world, client_for):
    client = client_for(world.staff)
    url = f"/api/v1/patients/{world.patient.id}"
    other = User.objects.create_user(
        username="other.staff", role=Role.COORDINATOR, organization=world.hospital
    )
    assert (
        client_for(other).patch(url, {"address": "Other change"}, format="json").status_code == 200
    )
    assert client.patch(url, {"address": "Draft contact change"}, format="json").status_code == 200
    assert AuditEvent.objects.filter(action="PATIENT_UPDATED").count() == 2
    assert (
        client.post(
            f"/api/v1/discharges/{world.discharge.id}/confirm", {}, format="json"
        ).status_code
        == 201
    )
    assert client.patch(url, {"address": "Too late"}, format="json").status_code == 409
    world.patient.refresh_from_db()
    assert world.patient.address == "Draft contact change"


def test_admin_password_reset_revokes_sessions_without_returning_password(world, client_for):
    from datetime import timedelta

    from accounts.models import AuthSession

    session = AuthSession.objects.create(
        user=world.doctor,
        client="web",
        current_jti="synthetic-jti",
        expires_at=timezone.now() + timedelta(days=1),
    )
    password = "Synthetic-reset-password-927!"
    result = client_for(world.admin).patch(
        f"/api/v1/reference/accounts/{world.doctor.id}", {"password": password}, format="json"
    )
    assert result.status_code == 200 and "password" not in result.data
    world.doctor.refresh_from_db()
    session.refresh_from_db()
    assert world.doctor.check_password(password) and session.revoked_at is not None
    assert AuditEvent.objects.filter(action="ACCOUNT_UPDATED", actor=world.admin).exists()
