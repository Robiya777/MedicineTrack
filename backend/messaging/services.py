from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from accounts.models import Role, User
from care.models import Patient, PatientAssignment
from care.scopes import active_assignments
from care.services import audit, enqueue
from common.exceptions import Conflict

from .calendar import response_deadline
from .groups import doctor_patient_ids, team_doctors
from .models import (
    AssistantAssessment,
    Conversation,
    Message,
    PatientStatusUpdate,
    ResponseEpisode,
    WorkSchedule,
)


def conversations_for(user):
    queryset = Conversation.objects.all()
    if user.role == Role.PATIENT:
        return queryset.filter(patient_id=user.patient_id)
    if user.role == Role.DOCTOR:
        return queryset.filter(
            status="OPEN",
            patient_id__in=doctor_patient_ids(user),
        )
    return queryset.none()


def patient_coordinators(patient):
    users = User.objects.filter(role=Role.COORDINATOR, is_active=True, organization__active=True)
    if patient.territory_id == patient.created_by_org.territory_id:
        return users.filter(organization__territory_id=patient.territory_id)
    return users.filter(organization_id=patient.created_by_org_id)


def schedule_snapshot(doctor):
    schedule = WorkSchedule.objects.filter(doctor=doctor).first() if doctor else None
    if not schedule:
        return {}
    return {
        "id": str(schedule.id),
        "version": schedule.version,
        "timezone": schedule.timezone,
        "shifts": schedule.shifts,
        "exceptions": schedule.exceptions,
    }


@transaction.atomic
def ensure_conversation(patient_id):
    patient = Patient.objects.select_for_update().get(pk=patient_id)
    assignment = active_assignments().filter(patient=patient).select_related("doctor").first()
    current = (
        Conversation.objects.select_for_update().filter(patient=patient, status="OPEN").first()
    )
    if current and current.assignment_id == (assignment.pk if assignment else None):
        return current
    pending = None
    if current:
        current.status = "CLOSED"
        current.save(update_fields=["status"])
        pending = ResponseEpisode.objects.filter(
            conversation=current, responded_at__isnull=True
        ).first()
    conversation = Conversation.objects.create(
        patient=patient, assignment=assignment, doctor=assignment.doctor if assignment else None
    )
    if pending:
        pending.conversation = conversation
        pending.save(update_fields=["conversation"])
    return conversation


@transaction.atomic
def change_assignment(patient_id, doctor):
    Patient.objects.select_for_update().get(pk=patient_id)
    now = timezone.now()
    current = PatientAssignment.objects.filter(patient_id=patient_id, valid_to__isnull=True).first()
    if current and current.doctor_id == doctor.pk:
        return ensure_conversation(patient_id)
    if current:
        current.valid_to = now
        current.save(update_fields=["valid_to"])
    PatientAssignment.objects.create(
        patient_id=patient_id, doctor=doctor, organization=doctor.organization, valid_from=now
    )
    return ensure_conversation(patient_id)


def locked_conversation(pk, user):
    # Lock the patient before the conversation: same order as reassignment.
    visible = get_object_or_404(conversations_for(user), pk=pk)
    Patient.objects.select_for_update().get(pk=visible.patient_id)
    conversation = (
        conversations_for(user).select_for_update().select_related("patient").filter(pk=pk).first()
    )
    if not conversation:
        raise PermissionDenied()
    if conversation.status != "OPEN":
        raise Conflict("Yopiq suhbatga yozib bo‘lmaydi.")
    assignment = active_assignments().filter(patient_id=conversation.patient_id).first()
    current_target = (assignment.pk, assignment.doctor_id) if assignment else (None, None)
    if (conversation.assignment_id, conversation.doctor_id) != current_target:
        raise Conflict("Mas’ul shifokor biriktirilishi o‘zgargan. Suhbatlar ro‘yxatini yangilang.")
    return conversation


def open_episode(conversation, now):
    episode = ResponseEpisode.objects.filter(
        conversation=conversation, responded_at__isnull=True
    ).first()
    if episode:
        return episode
    snapshot = schedule_snapshot(conversation.doctor)
    due = response_deadline(now, snapshot) if snapshot else None
    episode = ResponseEpisode.objects.create(
        conversation=conversation,
        first_unanswered_at=now,
        response_due_at=due,
        schedule_snapshot=snapshot,
    )
    if due is None:
        enqueue(
            None,
            "RESPONSE_SCHEDULE_MISSING",
            patient_coordinators(conversation.patient),
            episode=episode,
        )
    return episode


@transaction.atomic
def send_message(pk, user, text, request=None, status_data=None, assistant_response_to=None):
    conversation = locked_conversation(pk, user)
    now = timezone.now()
    message = Message.objects.create(
        conversation=conversation,
        sender=user,
        text=text,
        sent_at=now,
        kind="STATUS" if status_data else "TEXT",
    )
    episode = None
    if user.role == Role.PATIENT:
        episode = open_episode(conversation, now)
        message.response_episode = episode
        message.save(update_fields=["response_episode"])
        recipients = list(team_doctors(conversation.patient_id))
        if not recipients:
            recipients = patient_coordinators(conversation.patient)
    elif user.role == Role.DOCTOR:
        AssistantAssessment.objects.filter(
            message__response_episode__conversation=conversation,
            reply_at__isnull=True,
            suppressed_at__isnull=True,
        ).update(suppressed_at=now, reply_reason="DOCTOR_REPLIED")
        ResponseEpisode.objects.filter(conversation=conversation, responded_at__isnull=True).update(
            responded_at=now
        )
        recipients = list(
            User.objects.filter(
                patient_id=conversation.patient_id, role=Role.PATIENT, is_active=True
            )
        )
        recipients.extend(team_doctors(conversation.patient_id).exclude(pk=user.pk))
    else:
        raise PermissionDenied()
    enqueue(
        None,
        "CHAT_MESSAGE",
        recipients,
        episode=episode,
        dedupe_prefix=str(message.id),
        conversation=conversation,
    )
    if status_data:
        update = PatientStatusUpdate.objects.create(
            conversation=conversation, message=message, received_at=now, **status_data
        )
        if status_data["self_reported_state"] == "WORSENED":
            enqueue(
                None,
                "PATIENT_WORSENED",
                patient_coordinators(conversation.patient),
                episode=episode,
                dedupe_prefix=str(update.id),
            )
    audit(user, message, "STATUS_SENT" if status_data else "MESSAGE_SENT", request=request)
    if user.role == Role.PATIENT:
        from .assistant import assessment_for_message

        assessment_for_message(message, assistant_response_to)
    return message
