from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import Role, User
from common.exceptions import Conflict

from .models import (
    OPEN_STATUSES,
    AssignmentHistory,
    AuditEvent,
    CareTask,
    Discharge,
    Organization,
    OutboxEvent,
    Patient,
    TaskStatus,
    VisitReport,
)
from .scopes import active_assignments, coordinator_scope, is_hospital_staff


def audit(actor, entity, action, fields=(), request=None):
    AuditEvent.objects.create(
        actor=actor,
        entity_type=entity._meta.label,
        entity_id=entity.pk,
        action=action,
        changed_fields=list(fields),
        request_id=getattr(request, "request_id", ""),
    )


def require_role(user, *roles):
    if user.role not in roles:
        raise PermissionDenied()


def require_hospital_staff(user):
    if not is_hospital_staff(user):
        raise PermissionDenied()


def task_coordinators(task):
    users = User.objects.filter(role=Role.COORDINATOR, is_active=True, organization__active=True)
    if task.receiving_org_id is None:
        return users.filter(organization_id=task.discharge.hospital_id)
    return users.filter(organization__territory_id=task.service_territory_id)


def enqueue(task, event_type, recipients, episode=None, dedupe_prefix=None, conversation=None):
    now = timezone.now()
    for recipient in recipients:
        key = f"{dedupe_prefix or (episode.pk if episode else task.pk)}:{event_type}:{recipient.pk}"
        OutboxEvent.objects.get_or_create(
            dedupe_key=key,
            defaults={
                "task": task,
                "episode": episode,
                "event_type": event_type,
                "conversation": conversation or (episode.conversation if episode else None),
                "recipient": recipient,
                "next_attempt_at": now,
            },
        )


@transaction.atomic
def confirm_discharge(discharge_id, user, request=None):
    require_hospital_staff(user)
    discharge = (
        Discharge.objects.select_for_update(of=("self",))
        .select_related("patient", "hospital")
        .get(pk=discharge_id, created_by=user, hospital_id=user.organization_id)
    )
    if discharge.status == Discharge.Status.CONFIRMED:
        return discharge.task, False
    now = timezone.now()
    if discharge.discharged_at > now:
        raise ValidationError({"discharged_at": "Kelajakdagi chiqarishni tasdiqlash mumkin emas."})
    if not discharge.recommendations.strip() or not discharge.follow_up_reason.strip():
        raise ValidationError({"recommendations": "Tavsiyalar va kuzatuv asosi majburiy."})
    patient = Patient.objects.select_for_update().get(pk=discharge.patient_id)
    assignment = (
        active_assignments()
        .select_related("doctor__organization", "organization")
        .filter(patient=patient)
        .first()
    )
    if assignment and assignment.doctor.organization_id != assignment.organization_id:
        assignment = None
    # Cross-territory cases remain in the originating hospital's exception queue.
    same_territory = patient.territory_id == discharge.hospital.territory_id
    if not same_territory:
        assignment = None
    clinics = (
        list(
            Organization.objects.filter(
                type=Organization.Type.CLINIC, territory_id=patient.territory_id, active=True
            ).order_by("id")[:2]
        )
        if same_territory
        else []
    )
    receiving_org = (
        assignment.organization if assignment else (clinics[0] if len(clinics) == 1 else None)
    )
    snapshot = {
        name: getattr(patient, name)
        for name in [
            "full_name",
            "address",
            "contact",
            "contact_is_representative",
            "no_phone_reason",
        ]
    }
    snapshot.update(
        {
            "id": str(patient.id),
            "birth_date": patient.birth_date.isoformat(),
            "territory_id": str(patient.territory_id),
        }
    )
    discharge.patient_snapshot = snapshot
    discharge.status = Discharge.Status.CONFIRMED
    discharge.confirmed_at = now
    discharge.save(update_fields=["patient_snapshot", "status", "confirmed_at"])
    task = CareTask.objects.create(
        discharge=discharge,
        assigned_doctor=assignment.doctor if assignment else None,
        receiving_org=receiving_org,
        service_territory_id=patient.territory_id,
        status=TaskStatus.NEW if assignment else TaskStatus.UNASSIGNED,
        due_at=discharge.discharged_at + timedelta(hours=24),
    )
    enqueue(task, "TASK_CREATED", [assignment.doctor] if assignment else task_coordinators(task))
    if now > task.due_at:
        enqueue(task, "TASK_OVERDUE", task_coordinators(task))
    elif now >= discharge.discharged_at + timedelta(hours=12):
        enqueue(
            task,
            "TASK_CURRENT_WARNING",
            [assignment.doctor] if assignment else task_coordinators(task),
        )
    audit(user, task, "TASK_CREATED", request=request)
    return task, True


def locked_task(pk, version):
    task = (
        CareTask.objects.select_for_update(of=("self",))
        .select_related("discharge", "discharge__hospital")
        .get(pk=pk)
    )
    if version != task.version:
        raise Conflict()
    if task.status not in OPEN_STATUSES:
        raise Conflict("Yopilgan vazifani o‘zgartirish mumkin emas.")
    return task


@transaction.atomic
def accept_task(pk, user, version, request=None):
    require_role(user, Role.DOCTOR)
    task = locked_task(pk, version)
    if task.assigned_doctor_id != user.pk:
        raise PermissionDenied()
    if task.status != TaskStatus.NEW:
        raise Conflict("Faqat yangi vazifani qabul qilish mumkin.")
    task.status, task.accepted_at = TaskStatus.ACCEPTED, timezone.now()
    task.version += 1
    task.save(update_fields=["status", "accepted_at", "version"])
    audit(user, task, "TASK_ACCEPTED", request=request)
    return task


@transaction.atomic
def complete_task(pk, user, data, request=None):
    require_role(user, Role.DOCTOR)
    task = locked_task(pk, data.pop("version"))
    if task.assigned_doctor_id != user.pk:
        raise PermissionDenied()
    if task.status != TaskStatus.ACCEPTED:
        raise Conflict("Avval vazifani qabul qiling.")
    if not task.discharge.discharged_at <= data["performed_at"] <= timezone.now():
        raise ValidationError(
            {"performed_at": "Vaqt chiqarish va hozirgi vaqt oralig‘ida bo‘lishi kerak."}
        )
    VisitReport.objects.create(task=task, author=user, **data)
    task.status, task.completed_at = TaskStatus.COMPLETED, timezone.now()
    task.version += 1
    task.save(update_fields=["status", "completed_at", "version"])
    audit(user, task, "TASK_COMPLETED", request=request)
    return task


@transaction.atomic
def reassign_task(pk, user, data, request=None):
    require_role(user, Role.COORDINATOR)
    task = locked_task(pk, data["version"])
    if not CareTask.objects.filter(pk=pk).filter(coordinator_scope(user)).exists():
        raise PermissionDenied()
    if task.service_territory_id != user.organization.territory_id:
        raise ValidationError({"doctor_id": "Hududlararo transfer MVPga kirmaydi."})
    doctor = (
        User.objects.select_related("organization")
        .filter(
            pk=data["doctor_id"],
            role=Role.DOCTOR,
            is_active=True,
            organization__active=True,
            organization__type=Organization.Type.CLINIC,
            organization__territory_id=task.service_territory_id,
        )
        .first()
    )
    if not doctor:
        raise ValidationError({"doctor_id": "Hududdagi faol poliklinika shifokorini tanlang."})
    if doctor.pk == task.assigned_doctor_id:
        raise Conflict("Shifokor allaqachon biriktirilgan.")
    AssignmentHistory.objects.create(
        task=task,
        old_doctor_id=task.assigned_doctor_id,
        new_doctor=doctor,
        reason=data["reason"],
        actor=user,
    )
    task.assigned_doctor, task.receiving_org = doctor, doctor.organization
    task.status, task.accepted_at = TaskStatus.NEW, None
    task.version += 1
    task.save(
        update_fields=["assigned_doctor", "receiving_org", "status", "accepted_at", "version"]
    )
    from messaging.services import change_assignment

    change_assignment(task.discharge.patient_id, doctor)
    enqueue(task, "TASK_REASSIGNED", [doctor], dedupe_prefix=f"{task.id}:{task.version}")
    audit(user, task, "TASK_REASSIGNED", ["assigned_doctor", "status"], request)
    return task


@transaction.atomic
def cancel_task(pk, user, data, request=None):
    require_role(user, Role.COORDINATOR)
    task = locked_task(pk, data["version"])
    if not CareTask.objects.filter(pk=pk).filter(coordinator_scope(user)).exists():
        raise PermissionDenied()
    task.status = TaskStatus.CANCELLED
    task.cancellation_code, task.cancellation_note = data["reason_code"], data["reason"]
    task.cancelled_by, task.cancelled_at = user, timezone.now()
    task.version += 1
    task.save(
        update_fields=[
            "status",
            "cancellation_code",
            "cancellation_note",
            "cancelled_by",
            "cancelled_at",
            "version",
        ]
    )
    audit(user, task, "TASK_CANCELLED", request=request)
    return task
