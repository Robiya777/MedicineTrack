from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Role, User
from care.models import Discharge, Organization, Patient, PatientAssignment, Territory
from care.services import confirm_discharge
from messaging.models import WorkSchedule


@pytest.fixture(autouse=True)
def test_settings(settings, tmp_path):
    settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    settings.MEDIA_ROOT = tmp_path / "private"
    settings.AI_MODE = "mock"
    settings.DEMO_MODE = True
    cache.clear()


@pytest.fixture
def world(db):
    territory = Territory.objects.create(name="Synthetic territory")
    other_territory = Territory.objects.create(name="Other synthetic territory")
    hospital = Organization.objects.create(
        name="Synthetic hospital", type="HOSPITAL", territory=territory
    )
    clinic = Organization.objects.create(
        name="Synthetic clinic", type="CLINIC", territory=territory
    )
    other_hospital = Organization.objects.create(
        name="Other hospital", type="HOSPITAL", territory=other_territory
    )
    staff = User.objects.create_user(
        username="staff", password="Test-example-927!", role=Role.HOSPITAL, organization=hospital
    )
    doctor = User.objects.create_user(
        username="doctor", password="Test-example-927!", role=Role.DOCTOR, organization=clinic
    )
    doctor2 = User.objects.create_user(
        username="doctor2", password="Test-example-927!", role=Role.DOCTOR, organization=clinic
    )
    coordinator = User.objects.create_user(
        username="coordinator",
        password="Test-example-927!",
        role=Role.COORDINATOR,
        organization=hospital,
    )
    outsider = User.objects.create_user(
        username="outsider", role=Role.COORDINATOR, organization=other_hospital
    )
    admin = User.objects.create_user(username="admin", role=Role.ADMIN)
    patient = Patient.objects.create(
        created_by=staff,
        created_by_org=hospital,
        full_name="Synthetic Patient",
        birth_date=date(1980, 1, 1),
        address="Synthetic address",
        territory=territory,
        contact="+998900000001",
    )
    patient_user = User.objects.create_user(username="patient", role=Role.PATIENT, patient=patient)
    assignment = PatientAssignment.objects.create(
        patient=patient,
        doctor=doctor,
        organization=clinic,
        valid_from=timezone.now() - timedelta(days=2),
    )
    discharge = Discharge.objects.create(
        patient=patient,
        hospital=hospital,
        created_by=staff,
        discharged_at=timezone.now() - timedelta(hours=1),
        recommendations="Synthetic follow-up",
        follow_up_reason="Synthetic case",
    )
    WorkSchedule.objects.create(
        doctor=doctor,
        organization=clinic,
        shifts=[{"weekday": day, "start": "09:00", "end": "18:00"} for day in range(5)],
    )
    return SimpleNamespace(**locals())


@pytest.fixture
def client_for():
    def make(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    return make


@pytest.fixture
def task(world):
    return confirm_discharge(world.discharge.id, world.staff)[0]
