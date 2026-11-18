"""Explicit chat membership supplements the primary clinical assignment, without granting task access."""

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import Role, User
from accounts.presence import online_doctor_ids
from care.models import Patient
from care.scopes import active_assignments, is_discharge_coordinator, patients_for

from .models import ChatDoctorMembership


def doctor_patient_ids(user):
    return Patient.objects.filter(
        Q(pk__in=active_assignments().filter(doctor=user).values("patient_id"))
        | Q(
            pk__in=ChatDoctorMembership.objects.filter(doctor=user, removed_at__isnull=True).values(
                "patient_id"
            )
        )
    ).values("pk")


def team_doctors(patient_id):
    return (
        User.objects.filter(role=Role.DOCTOR, is_active=True, organization__active=True)
        .filter(
            Q(pk__in=active_assignments().filter(patient_id=patient_id).values("doctor_id"))
            | Q(
                pk__in=ChatDoctorMembership.objects.filter(
                    patient_id=patient_id, removed_at__isnull=True
                ).values("doctor_id")
            )
        )
        .order_by("first_name", "last_name", "username")
    )


def team_online(patient_id, now=None):
    return bool(online_doctor_ids(team_doctors(patient_id).values_list("id", flat=True), now))


def team_metadata(patient_id):
    doctors = list(team_doctors(patient_id))
    online = online_doctor_ids([doctor.pk for doctor in doctors])
    primary_ids = set(
        active_assignments().filter(patient_id=patient_id).values_list("doctor_id", flat=True)
    )
    return [
        {
            "id": str(doctor.pk),
            "name": doctor.get_full_name() or doctor.username,
            "online": doctor.pk in online,
            "primary": doctor.pk in primary_ids,
        }
        for doctor in doctors
    ]


def can_manage_team(user, patient):
    return (
        is_discharge_coordinator(user) and patients_for(user).filter(pk=patient.pk).exists()
    ) or (
        user.role == Role.DOCTOR
        and active_assignments().filter(patient=patient, doctor=user).exists()
    )


def visible_team_patient(user, pk, write=False):
    if user.role == Role.PATIENT:
        rows = Patient.objects.filter(pk=user.patient_id)
    elif user.role == Role.DOCTOR:
        rows = Patient.objects.filter(pk__in=doctor_patient_ids(user))
    elif is_discharge_coordinator(user):
        rows = patients_for(user)
    else:
        rows = Patient.objects.none()
    patient = get_object_or_404(rows.select_related("created_by_org"), pk=pk)
    if write and not can_manage_team(user, patient):
        raise PermissionDenied("Jamoani mas’ul shifokor yoki hudud koordinatori boshqaradi.")
    return patient


def available_doctors(patient):
    return (
        User.objects.filter(role=Role.DOCTOR, is_active=True, organization__active=True)
        .filter(
            Q(organization__territory_id=patient.territory_id)
            | Q(organization_id=patient.created_by_org_id)
        )
        .order_by("first_name", "last_name", "username")
    )


@transaction.atomic
def change_team(user, pk, doctor_id, action, request=None):
    from care.services import audit, enqueue

    from .services import ensure_conversation

    patient = visible_team_patient(user, pk, write=True)
    Patient.objects.select_for_update().get(pk=patient.pk)
    # Recheck permissions after taking the same patient lock used by messages and reassignment.
    patient = visible_team_patient(user, pk, write=True)
    if active_assignments().filter(patient=patient, doctor_id=doctor_id).exists():
        raise ValidationError(
            "Mas’ul shifokor chatda avtomatik qatnashadi. Uni biriktirish orqali o‘zgartiring."
        )
    if action == "ADD":
        doctor = get_object_or_404(available_doctors(patient), pk=doctor_id)
        membership, created = ChatDoctorMembership.objects.get_or_create(
            patient=patient, doctor=doctor, removed_at__isnull=True, defaults={"added_by": user}
        )
        if created:
            conversation = ensure_conversation(patient.pk)
            enqueue(
                None,
                "CHAT_TEAM_ADDED",
                [doctor],
                dedupe_prefix=str(membership.pk),
                conversation=conversation,
            )
            audit(user, membership, "CHAT_DOCTOR_ADDED", request=request)
    else:
        membership = get_object_or_404(
            ChatDoctorMembership, patient=patient, doctor_id=doctor_id, removed_at__isnull=True
        )
        membership.removed_at = timezone.now()
        membership.save(update_fields=["removed_at"])
        audit(user, membership, "CHAT_DOCTOR_REMOVED", request=request)
