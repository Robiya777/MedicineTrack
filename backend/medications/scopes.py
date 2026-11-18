from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from accounts.models import Role
from care.models import Patient
from care.scopes import active_assignments, is_discharge_coordinator

from .models import DoseOccurrence, DoseRecord, MedicationPlan, PlanStatus


def patients_for_medications(user):
    queryset = Patient.objects.all()
    if user.role == Role.PATIENT:
        return queryset.filter(pk=user.patient_id)
    if is_discharge_coordinator(user):
        return queryset.filter(created_by_org_id=user.organization_id)
    if user.role == Role.DOCTOR:
        return queryset.filter(pk__in=active_assignments().filter(doctor=user).values("patient_id"))
    return queryset.none()


def plans_for(user):
    queryset = MedicationPlan.objects.all()
    if is_discharge_coordinator(user):
        return queryset.filter(
            discharge__managing_organization_id=user.organization_id
        )
    queryset = queryset.filter(patient__in=patients_for_medications(user))
    return queryset.exclude(status=PlanStatus.DRAFT) if user.role == Role.PATIENT else queryset


def occurrences_for(user):
    if user.role not in {Role.PATIENT, Role.DOCTOR}:
        return DoseOccurrence.objects.none()
    return DoseOccurrence.objects.filter(
        item__plan__in=plans_for(user).exclude(status=PlanStatus.DRAFT)
    )


def intake_patients_for(user):
    if user.role == Role.PATIENT:
        return Patient.objects.filter(pk=user.patient_id)
    if user.role == Role.DOCTOR:
        return Patient.objects.filter(
            pk__in=active_assignments().filter(doctor=user).values("patient_id")
        )
    return Patient.objects.none()


def records_for(user):
    return DoseRecord.objects.filter(occurrence__in=occurrences_for(user))


def require_doctor(user, approve=False):
    if user.role != Role.DOCTOR or (approve and not user.can_approve_medication_schedule):
        raise PermissionDenied(
            "Jadvalni tasdiqlash uchun DOCTOR va alohida klinik ruxsat kerak."
            if approve
            else "Faqat vakolatli shifokor uchun."
        )


def require_patient(user):
    if user.role != Role.PATIENT or not user.patient_id:
        raise PermissionDenied("Qabul qaydi faqat bemorning o‘zi uchun.")


def visible_patient(user, pk):
    return get_object_or_404(patients_for_medications(user), pk=pk)
