from datetime import timedelta
from uuid import uuid4

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


def test_tab_web_cookies_are_independent(world, settings):
    settings.COOKIE_SECURE = True
    client = APIClient(enforce_csrf_checks=True)
    csrf = client.get("/api/v1/auth/csrf").data["csrf_token"]
    client.credentials(HTTP_X_CSRFTOKEN=csrf)
    tab_a, tab_b = str(uuid4()), str(uuid4())
    a = login(client, client="web", tab_id=tab_a)
    b = login(client, username=world.doctor.username, client="web", tab_id=tab_b)
    assert a.status_code == b.status_code == 200
    name_a, name_b = "refresh_token_" + tab_a.replace("-", ""), "refresh_token_" + tab_b.replace("-", "")
    assert a.cookies[name_a]["httponly"] and b.cookies[name_b]["httponly"]
    assert a.cookies[name_a]["secure"] and b.cookies[name_b]["secure"]
    assert "refresh" not in a.data and "refresh" not in b.data
    assert "refresh_token" not in a.cookies and "refresh_token" not in b.cookies
    refreshed_a = client.post("/api/v1/auth/refresh", {"tab_id": tab_a}, format="json")
    refreshed_b = client.post("/api/v1/auth/refresh", {"tab_id": tab_b}, format="json")
    assert refreshed_a.data["user"]["id"] == a.data["user"]["id"]
    assert refreshed_b.data["user"]["id"] == b.data["user"]["id"]
    client.credentials(HTTP_X_CSRFTOKEN=csrf, HTTP_AUTHORIZATION=f"Bearer {refreshed_a.data['access']}")
    out = client.post("/api/v1/auth/logout", {"tab_id": tab_a}, format="json")
    assert out.status_code == 204 and out.cookies[name_a]["max-age"] == 0
    assert name_b not in out.cookies
    client.credentials(HTTP_X_CSRFTOKEN=csrf)
    assert client.post("/api/v1/auth/refresh", {"tab_id": tab_b}, format="json").status_code == 200


def test_tab_refresh_does_not_fall_back_to_shared_cookie(world):
    client = APIClient()
    assert login(client, client="web").status_code == 200
    assert client.post("/api/v1/auth/refresh", {"tab_id": str(uuid4())}, format="json").status_code == 401
    assert login(client, client="web", tab_id="not-a-uuid").status_code == 400
