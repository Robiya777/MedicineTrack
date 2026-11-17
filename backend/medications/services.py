from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import Role
from care.models import Discharge, Patient
from care.scopes import is_hospital_staff
from care.services import audit
from common.exceptions import Conflict

from .models import (
    DoseOccurrence,
    DoseRecord,
    DoseRecordCorrection,
    MedicationItem,
    MedicationPlan,
    PlanStatus,
)
from .scheduling import prepare_occurrences
from .scopes import occurrences_for, plans_for, records_for, require_doctor, visible_patient


def lock_context(discharge_id, patient_id):
    # Match discharge confirmation's lock order, including FK key-share locks.
    Discharge.objects.select_for_update().get(pk=discharge_id)
    Patient.objects.select_for_update().get(pk=patient_id)


def locked_plan(pk, user, expected):
    visible = get_object_or_404(plans_for(user), pk=pk)
    lock_context(visible.discharge_id, visible.patient_id)
    plan = get_object_or_404(plans_for(user).select_for_update(of=("self",)), pk=pk)
    if plan.version != expected["version"] or plan.lock_version != expected["lock_version"]:
        raise Conflict("Jadval versiyasi o‘zgargan. Yangilangan jadvalni oling.")
    return plan


def replace_items(plan, items):
    plan.items.all().delete()
    MedicationItem.objects.bulk_create([MedicationItem(plan=plan, **data) for data in items])


@transaction.atomic
def create_plan(patient_id, user, data, request=None):
    patient = visible_patient(user, patient_id)
    if user.role != Role.DOCTOR and not is_hospital_staff(user):
        raise PermissionDenied()
    discharge = get_object_or_404(Discharge, pk=data["discharge_id"], patient=patient)
    if is_hospital_staff(user) and (
        discharge.created_by_id != user.pk or discharge.hospital_id != user.organization_id
    ):
        raise PermissionDenied()
    lock_context(discharge.id, patient.id)
    visible_patient(user, patient_id)
    plan = MedicationPlan.objects.create(patient=patient, discharge=discharge, created_by=user)
    replace_items(plan, data["items"])
    audit(user, plan, "MEDICATION_DRAFT_CREATED", request=request)
    return plan


@transaction.atomic
def update_draft(pk, user, data, request=None):
    if user.role != Role.DOCTOR and not is_hospital_staff(user):
        raise PermissionDenied()
    plan = locked_plan(pk, user, data)
    if plan.status != PlanStatus.DRAFT:
        raise Conflict("Faol jadvalni tahrirlash uchun yangi revision yarating.")
    if "items" in data:
        replace_items(plan, data["items"])
    plan.lock_version += 1
    plan.save(update_fields=["lock_version", "updated_at"])
    audit(user, plan, "MEDICATION_DRAFT_UPDATED", ["items"], request)
    return plan


def deactivate(plan, actor, reason, now):
    plan.status, plan.stopped_at, plan.stopped_by, plan.stop_reason = (
        PlanStatus.STOPPED,
        now,
        actor,
        reason,
    )
    plan.lock_version += 1
    plan.save(
        update_fields=[
            "status",
            "stopped_at",
            "stopped_by",
            "stop_reason",
            "lock_version",
            "updated_at",
        ]
    )
    DoseOccurrence.objects.filter(
        item__plan=plan, scheduled_at__gte=now, cancelled_at__isnull=True
    ).update(
        cancelled_at=now,
        cancellation_reason="SUPERSEDED" if reason == "SUPERSEDED" else "PLAN_STOPPED",
    )


@transaction.atomic
def approve_plan(pk, user, expected, request=None):
    require_doctor(user, approve=True)
    plan = locked_plan(pk, user, expected)
    if plan.status != PlanStatus.DRAFT:
        raise Conflict("Faqat DRAFT jadval tasdiqlanadi.")
    rows, ends_at = prepare_occurrences(plan, list(plan.items.all()))
    now = timezone.now()
    if plan.supersedes_id:
        previous = MedicationPlan.objects.select_for_update().get(pk=plan.supersedes_id)
        if previous.status != PlanStatus.ACTIVE:
            raise Conflict("Oldingi faol jadval o‘zgargan yoki to‘xtatilgan.")
        deactivate(previous, user, "SUPERSEDED", now)
        audit(user, previous, "MEDICATION_SUPERSEDED", request=request)
        # The old course owns its past. A revision only schedules future doses.
        rows = [row for row in rows if row.scheduled_at >= now]
        if not rows:
            raise ValidationError({"items": "Yangi versiyada kelajakdagi qabul vaqti kerak."})
    plan.status = PlanStatus.COMPLETED if ends_at <= now else PlanStatus.ACTIVE
    plan.approved_by, plan.approved_at, plan.ends_at = user, now, ends_at
    plan.completed_at = now if plan.status == PlanStatus.COMPLETED else None
    plan.lock_version += 1
    plan.save(
        update_fields=[
            "status",
            "approved_by",
            "approved_at",
            "ends_at",
            "completed_at",
            "lock_version",
            "updated_at",
        ]
    )
    DoseOccurrence.objects.bulk_create(rows, batch_size=1000)
    audit(user, plan, "MEDICATION_APPROVED", ["status"], request)
    return plan


@transaction.atomic
def revise_plan(pk, user, data, request=None):
    require_doctor(user)
    plan = locked_plan(pk, user, data)
    if plan.status != PlanStatus.ACTIVE:
        raise Conflict("Faqat faol jadvaldan revision yaratiladi.")
    if plan.revisions.filter(status=PlanStatus.DRAFT).exists():
        raise Conflict("Bu jadval uchun tekshirilmagan revision mavjud.")
    revision = MedicationPlan.objects.create(
        patient_id=plan.patient_id,
        discharge_id=plan.discharge_id,
        created_by=user,
        series_id=plan.series_id,
        version=plan.version + 1,
        supersedes=plan,
    )
    if "items" in data:
        items = data["items"]
    else:
        fields = [
            "name",
            "prescribed_dose_text",
            "route",
            "instructions",
            "source_reference",
            "start_date",
            "end_date",
            "timezone",
            "local_times",
            "needs_clarification",
            "clarification_reason",
        ]
        items = [{key: getattr(item, key) for key in fields} for item in plan.items.all()]
    replace_items(revision, items)
    plan.lock_version += 1
    plan.save(update_fields=["lock_version", "updated_at"])
    audit(user, revision, "MEDICATION_REVISION_CREATED", request=request)
    return revision


@transaction.atomic
def stop_plan(pk, user, data, request=None):
    require_doctor(user)
    plan = locked_plan(pk, user, data)
    if plan.status != PlanStatus.ACTIVE:
        raise Conflict("Faqat faol jadval to‘xtatiladi.")
    deactivate(plan, user, data["reason"], timezone.now())
    audit(user, plan, "MEDICATION_STOPPED", ["status"], request)
    return plan


def validate_record_times(occurrence, data, now):
    if data["plan_version"] != occurrence.plan_version:
        raise Conflict("Occurrence va jadval versiyasi mos emas.")
    if occurrence.scheduled_at > now:
        raise ValidationError({"occurrence": "Kelajakdagi qabulni belgilash mumkin emas."})
    if not occurrence.scheduled_at <= data["client_recorded_at"] <= now:
        raise ValidationError(
            {"client_recorded_at": "Qayd vaqti rejalashtirilgan vaqt va hozir oralig‘ida bo‘lsin."}
        )
    taken = data.get("reported_taken_at")
    if data["result"] == "TAKEN" and (
        taken is None or not occurrence.scheduled_at <= taken <= data["client_recorded_at"]
    ):
        raise ValidationError(
            {
                "reported_taken_at": "Haqiqiy qabul vaqti rejalashtirilgan vaqtdan oldin yoki qayd vaqtidan keyin bo‘lmaydi."
            }
        )
    if data["result"] == "SKIPPED" and taken is not None:
        raise ValidationError({"reported_taken_at": "SKIPPED uchun null bo‘lishi kerak."})


@transaction.atomic
def record_dose(pk, user, data, request=None):
    if user.role != Role.PATIENT:
        raise PermissionDenied("Qabulni faqat bemorning o‘zi qayd etadi.")
    visible = get_object_or_404(occurrences_for(user).select_related("item__plan"), pk=pk)
    plan = visible.item.plan
    lock_context(plan.discharge_id, plan.patient_id)
    occurrence = get_object_or_404(occurrences_for(user).select_for_update(of=("self",)), pk=pk)
    plan.refresh_from_db()
    now = timezone.now()
    validate_record_times(occurrence, data, now)
    values = {key: data.get(key) for key in ["result", "reported_taken_at", "client_recorded_at"]}
    values["note"] = data.get("note", "")
    existing = DoseRecord.objects.filter(occurrence=occurrence).first()
    if existing:
        if all(getattr(existing, key) == value for key, value in values.items()):
            return existing, False
        raise Conflict("Qabul allaqachon qayd etilgan. Tuzatish endpointidan foydalaning.")
    record = DoseRecord.objects.create(
        occurrence=occurrence,
        patient_user=user,
        server_received_at=now,
        recorded_against_inactive_plan=plan.status in {PlanStatus.STOPPED, PlanStatus.COMPLETED}
        or occurrence.cancelled_at is not None,
        **values,
    )
    audit(user, record, "DOSE_SELF_REPORTED", request=request)
    return record, True


@transaction.atomic
def correct_dose(pk, user, data, request=None):
    if user.role != Role.PATIENT:
        raise PermissionDenied("Qaydni faqat shu bemor tuzatishi mumkin.")
    visible = get_object_or_404(
        records_for(user).select_related("occurrence__item__plan"), pk=pk, patient_user=user
    )
    plan = visible.occurrence.item.plan
    lock_context(plan.discharge_id, plan.patient_id)
    record = get_object_or_404(
        records_for(user).select_for_update(of=("self",)), pk=pk, patient_user=user
    )
    if data["version"] != record.version:
        raise Conflict("Qayd versiyasi o‘zgargan.")
    validate_record_times(record.occurrence, data, timezone.now())
    DoseRecordCorrection.objects.create(
        record=record,
        version=record.version + 1,
        actor=user,
        **{
            key: data.get(key, "" if key == "note" else None)
            for key in ["result", "reported_taken_at", "client_recorded_at", "note", "reason"]
        },
    )
    record.version += 1
    record.save(update_fields=["version"])
    audit(user, record, "DOSE_RECORD_CORRECTED", ["result", "reported_taken_at", "note"], request)
    return record
