import pytest

pytestmark = pytest.mark.django_db


def test_admin_manages_staff_without_patient_access(world, task, client_for):
    client = client_for(world.admin)
    response = client.post(
        "/api/v1/reference/accounts",
        {
            "username": "new.doctor",
            "password": "Synthetic-demo-pass-927!",
            "role": "DOCTOR",
            "organization": str(world.clinic.id),
        },
        format="json",
    )
    assert response.status_code == 201
    assert "password" not in response.data
    accounts = client.get("/api/v1/reference/accounts").data["results"]
    assert all(item["role"] != "PATIENT" and "patient" not in item for item in accounts)
    assert client.get(f"/api/v1/tasks/{task.id}").status_code == 404
    assert client_for(world.doctor).get("/api/v1/reference/accounts").status_code == 403


def test_staff_role_requires_matching_organization(world, client_for):
    response = client_for(world.admin).post(
        "/api/v1/reference/accounts",
        {
            "username": "invalid.doctor",
            "password": "Synthetic-demo-pass-927!",
            "role": "DOCTOR",
            "organization": str(world.hospital.id),
        },
        format="json",
    )
    assert response.status_code == 400
