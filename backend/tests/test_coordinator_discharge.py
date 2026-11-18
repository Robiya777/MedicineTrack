from datetime import date

import pytest
from django.utils import timezone
from accounts.models import Role, User
from care.models import AuditEvent, Discharge, Organization, Patient

pytestmark = pytest.mark.django_db


def payload(world, patient):
    return {"patient": str(patient.id), "hospital": str(world.hospital.id),
            "discharged_at": timezone.now().isoformat(), "recommendations": "Synthetic advice", "follow_up_reason": "Synthetic follow-up"}


def test_clinic_coordinator_creates_and_team_confirms(world, client_for):
    coordinator = User.objects.create_user(username="clinic.coordinator", role=Role.COORDINATOR, organization=world.clinic)
    teammate = User.objects.create_user(username="clinic.teammate", role=Role.COORDINATOR, organization=world.clinic)
    client = client_for(coordinator)
    result = client.post('/api/v1/patients', {"full_name": "Synthetic clinic patient", "birth_date": "1980-01-01", "address": "Synthetic", "territory": str(world.territory.id), "contact": "+998901234567"}, format='json')
    assert result.status_code == 201, result.data
    patient = Patient.objects.get(id=result.data['id'])
    result = client.post('/api/v1/discharges', payload(world, patient), format='json')
    assert result.status_code == 201, result.data
    discharge = Discharge.objects.get(id=result.data['id'])
    assert discharge.hospital == world.hospital and discharge.managing_organization == world.clinic
    assert client_for(world.coordinator).patch(f'/api/v1/discharges/{discharge.id}', {"recommendations": "Forbidden"}, format='json').status_code == 404
    team = client_for(teammate)
    assert team.patch(f'/api/v1/patients/{patient.id}', {"address": "Updated"}, format='json').status_code == 200
    first = team.post(f'/api/v1/discharges/{discharge.id}/confirm', {}, format='json', HTTP_IDEMPOTENCY_KEY='confirm-team')
    second = team.post(f'/api/v1/discharges/{discharge.id}/confirm', {}, format='json', HTTP_IDEMPOTENCY_KEY='confirm-team')
    assert first.status_code == second.status_code == 201
    assert first.data['id'] == second.data['id']
    assert team.post(f'/api/v1/patients/{patient.id}/activation', {"phone_verified": True}, format='json').status_code == 201
    assert team.patch(f'/api/v1/patients/{patient.id}', {"address": "Too late"}, format='json').status_code == 409
    assert AuditEvent.objects.filter(action='TASK_CREATED', actor=teammate).exists()
    assert discharge.created_by_id == coordinator.id


def test_coordinator_hospital_selection_is_scoped(world, client_for):
    client = client_for(world.coordinator)
    invalid = [world.clinic, world.other_hospital]
    inactive = Organization.objects.create(name='Inactive synthetic', type=Organization.Type.HOSPITAL, territory=world.territory, active=False)
    invalid.append(inactive)
    for org in invalid:
        result = client.post('/api/v1/discharges', {**payload(world, world.patient), 'hospital': str(org.id)}, format='json')
        assert result.status_code == 400
    result = client.post('/api/v1/discharges', {**payload(world, world.patient), 'managing_organization': str(world.other_hospital.id)}, format='json')
    assert result.status_code == 201
    assert str(result.data['managing_organization']) == str(world.hospital.id)


def test_outside_coordinator_and_clinical_roles_cannot_write(world, client_for):
    for user in [world.doctor, world.patient_user, world.admin]:
        assert client_for(user).post('/api/v1/discharges', payload(world, world.patient), format='json').status_code == 403
    result = client_for(world.outsider).post('/api/v1/discharges', payload(world, world.patient), format='json')
    assert result.status_code == 400
    team = client_for(world.coordinator)
    assert team.patch(f'/api/v1/discharges/{world.discharge.id}', {'recommendations': 'Team advice'}, format='json').status_code == 200
    assert client_for(world.outsider).post(f'/api/v1/discharges/{world.discharge.id}/confirm', {}, format='json').status_code == 404
