from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import ActivationCode, User

pytestmark = pytest.mark.django_db


def login(http_client, username="staff", **kwargs):
    return http_client.post(
        "/api/v1/auth/login",
        {"username": username, "password": "Test-example-927!", **kwargs},
        format="json",
    )


def test_refresh_reuse_revokes_entire_session(world):
    client = APIClient()
    initial = login(client)
    assert initial.status_code == 200
    first = initial.data["refresh"]
    rotated = client.post("/api/v1/auth/refresh", {"refresh": first}, format="json")
    assert rotated.status_code == 200 and rotated.data["refresh"] != first
    assert client.post("/api/v1/auth/refresh", {"refresh": first}, format="json").status_code == 401
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {rotated.data['access']}")
    assert client.get("/api/v1/me").status_code == 401


def test_logout_revokes_access_and_refresh(world):
    client = APIClient()
    tokens = login(client).data
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert client.get("/api/v1/me").status_code == 200
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/me").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/refresh", {"refresh": tokens["refresh"]}, format="json"
        ).status_code
        == 401
    )


def test_inactive_user_is_blocked_immediately(world):
    client = APIClient()
    tokens = login(client).data
    world.staff.is_active = False
    world.staff.save()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
    assert client.get("/api/v1/me").status_code == 401


def test_web_cookie_requires_csrf(world, settings):
    settings.COOKIE_SECURE = True
    client = APIClient(enforce_csrf_checks=True)
    assert login(client, client="web").status_code == 403
    csrf = client.get("/api/v1/auth/csrf").data["csrf_token"]
    client.credentials(HTTP_X_CSRFTOKEN=csrf)
    result = login(client, client="web")
    assert result.status_code == 200 and "refresh" not in result.data
    cookie = result.cookies["refresh_token"]
    assert cookie["httponly"] and cookie["secure"]
    client.credentials()
    assert client.post("/api/v1/auth/refresh", {}, format="json").status_code == 403
    client.credentials(HTTP_X_CSRFTOKEN=csrf)
    assert client.post("/api/v1/auth/refresh", {}, format="json").status_code == 200


def test_login_rate_limit(world):
    client = APIClient()
    for _ in range(10):
        assert login(client, username="wrong").status_code == 401
    assert login(client).status_code == 429


def issue_code(world, client_for):
    User.objects.filter(pk=world.patient_user.pk).delete()
    result = client_for(world.staff).post(
        f"/api/v1/patients/{world.patient.id}/activation", {"phone_verified": True}, format="json"
    )
    assert result.status_code == 201
    return result.data["code"]


def test_patient_activation_single_use_and_hash(world, client_for):
    code = issue_code(world, client_for)
    assert ActivationCode.objects.get().code_hash != code
    client = APIClient()
    payload = {"patient_id": str(world.patient.id), "code": code, "password": "Long-demo-pass-927!"}
    assert client.post("/api/v1/auth/patient-activate", payload, format="json").status_code == 201
    assert client.post("/api/v1/auth/patient-activate", payload, format="json").status_code == 401


def test_activation_lockout_survives_error_responses(world, client_for):
    code = issue_code(world, client_for)
    client = APIClient()
    payload = {
        "patient_id": str(world.patient.id),
        "code": "wrong",
        "password": "Long-demo-pass-927!",
    }
    for _ in range(5):
        assert (
            client.post("/api/v1/auth/patient-activate", payload, format="json").status_code == 401
        )
    activation = ActivationCode.objects.get()
    assert activation.attempts == 5
    payload["code"] = code
    assert client.post("/api/v1/auth/patient-activate", payload, format="json").status_code == 401


def test_expired_activation_is_rejected(world, client_for):
    code = issue_code(world, client_for)
    ActivationCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    response = APIClient().post(
        "/api/v1/auth/patient-activate",
        {"patient_id": str(world.patient.id), "code": code, "password": "Long-demo-pass-927!"},
        format="json",
    )
    assert response.status_code == 401
