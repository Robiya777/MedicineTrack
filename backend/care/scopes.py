from django.db.models import Q

from accounts.models import Role

from .models import OPEN_STATUSES, CareTask, Discharge, Patient


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
    if user.role == Role.HOSPITAL:
        return queryset.filter(discharge__created_by=user)
    if user.role == Role.DOCTOR:
        return queryset.filter(assigned_doctor=user)
    if user.role == Role.COORDINATOR:
        return queryset.filter(coordinator_scope(user))
    if user.role == Role.PATIENT:
        return queryset.filter(discharge__patient_id=user.patient_id)
    return queryset.none()


def patients_for(user):
    queryset = Patient.objects.all()
    if user.role == Role.HOSPITAL:
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
    if user.role == Role.HOSPITAL:
        return queryset.filter(created_by=user)
    return queryset.filter(task__in=tasks_for(user))
