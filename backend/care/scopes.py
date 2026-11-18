from django.db.models import F, Q
from django.utils import timezone

from accounts.models import Role

from .models import OPEN_STATUSES, CareTask, Discharge, Organization, Patient, PatientAssignment


def is_discharge_coordinator(user):
    return (
        user.role == Role.COORDINATOR
        and user.organization_id is not None
        and user.organization.active
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
    ) | Q(receiving_org__isnull=True, discharge__managing_organization_id=user.organization_id)


def tasks_for(user):
    queryset = CareTask.objects.all()
    if user.role == Role.DOCTOR:
        return queryset.filter(assigned_doctor=user, receiving_org_id=user.organization_id)
    if user.role == Role.COORDINATOR:
        return queryset.filter(coordinator_scope(user))
    if user.role == Role.PATIENT:
        return queryset.filter(discharge__patient_id=user.patient_id)
    return queryset.none()


def patients_for(user):
    queryset = Patient.objects.all()
    if is_discharge_coordinator(user):
        visible = queryset.filter(
            Q(created_by_org_id=user.organization_id) | Q(discharges__task__in=tasks_for(user))
        )
        # Keep joins inside the membership query: PostgreSQL can then lock the
        # outer Patient rows without combining FOR UPDATE with DISTINCT.
        return queryset.filter(pk__in=visible.order_by().values("pk"))
    if user.role == Role.PATIENT:
        return queryset.filter(pk=user.patient_id)
    if user.role == Role.DOCTOR:
        return queryset.filter(
            discharges__task__in=tasks_for(user).filter(status__in=OPEN_STATUSES)
        ).distinct()
    return queryset.none()


def discharges_for(user):
    queryset = Discharge.objects.all()
    if is_discharge_coordinator(user):
        return queryset.filter(managing_organization_id=user.organization_id)
    return queryset.filter(task__in=tasks_for(user))
