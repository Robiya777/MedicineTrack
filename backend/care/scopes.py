from django.db.models import F, Q
from django.utils import timezone

from accounts.models import Role

from .models import OPEN_STATUSES, CareTask, Discharge, Organization, Patient, PatientAssignment


def is_hospital_staff(user):
    return (
        user.role in {Role.HOSPITAL, Role.DOCTOR}
        and user.organization_id is not None
        and user.organization.active
        and user.organization.type == Organization.Type.HOSPITAL
    )


def active_assignments():
    return PatientAssignment.objects.filter(
        valid_to__isnull=True,
        valid_from__lte=timezone.now(),
        doctor__is_active=True,
        doctor__role=Role.DOCTOR,
        organization__active=True,
        organization__type=Organization.Type.CLINIC,
        doctor__organization_id=F("organization_id"),
        organization__territory_id=F("patient__territory_id"),
    )


def coordinator_scope(user):
    if user.role != Role.COORDINATOR or not user.organization_id:
        return Q(pk__in=[])
    territory = user.organization.territory_id
    return Q(
        service_territory_id=territory,
        discharge__hospital__territory_id=territory,
        receiving_org__isnull=False,
    ) | Q(receiving_org__isnull=True, discharge__hospital_id=user.organization_id)


def tasks_for(user):
    queryset = CareTask.objects.all()
    if is_hospital_staff(user):
        return queryset.filter(
            discharge__created_by=user, discharge__hospital_id=user.organization_id
        )
    if user.role == Role.DOCTOR:
        return queryset.filter(assigned_doctor=user)
    if user.role == Role.COORDINATOR:
        return queryset.filter(coordinator_scope(user))
    if user.role == Role.PATIENT:
        return queryset.filter(discharge__patient_id=user.patient_id)
    return queryset.none()


def patients_for(user):
    queryset = Patient.objects.all()
    if is_hospital_staff(user):
        return queryset.filter(created_by_org_id=user.organization_id)
    if user.role == Role.PATIENT:
        return queryset.filter(pk=user.patient_id)
    if user.role == Role.DOCTOR:
        return queryset.filter(
            discharges__task__in=tasks_for(user).filter(status__in=OPEN_STATUSES)
        ).distinct()
    if user.role == Role.COORDINATOR:
        return queryset.filter(discharges__task__in=tasks_for(user)).distinct()
    return queryset.none()


def discharges_for(user):
    queryset = Discharge.objects.all()
    if is_hospital_staff(user):
        return queryset.filter(created_by=user, hospital_id=user.organization_id)
    return queryset.filter(task__in=tasks_for(user))
