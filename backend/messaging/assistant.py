"""Patient-owned demo assistant and consented emergency location sharing."""

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import Role, User
from care.models import Patient
from care.services import audit, enqueue
from common.exceptions import Conflict

from .groups import doctor_patient_ids, team_doctors, team_online
from .models import AssistantAssessment, EmergencyEvent, EmergencyIncident
from .triage import assess


def assistant_enabled():
    return settings.DEMO_MODE and settings.ASSISTANT_MODE == "demo"


def incidents_for(user):
    rows = EmergencyIncident.objects.all()
    patient = "episode__conversation__patient"
    if user.role == Role.PATIENT and user.patient_id:
        return rows.filter(**{patient + "_id": user.patient_id})
    if user.role == Role.DOCTOR:
        return rows.filter(**{patient + "__in": doctor_patient_ids(user)})
    if user.role == Role.COORDINATOR and user.organization_id and user.organization.active:
        territory = user.organization.territory_id
        same = Q(
            **{
                patient + "__territory_id": territory,
                patient + "__created_by_org__territory_id": territory,
            }
        )
        original = Q(**{patient + "__created_by_org_id": user.organization_id}) & ~Q(
            **{patient + "__territory_id": F(patient + "__created_by_org__territory_id")}
        )
        return rows.filter(same | original)
    return rows.none()


def assessment_for_message(message, response_to=None):
    if not assistant_enabled():
        return None
    from .services import patient_coordinators

    previous = (
        AssistantAssessment.objects.filter(
            message__conversation__patient_id=message.conversation.patient_id,
            message__response_episode_id=message.response_episode_id,
            reply_at__gte=timezone.now() - timedelta(minutes=30),
        )
        .order_by("-created_at", "-id")
        .first()
    )
    if response_to and (not previous or previous.pk != response_to):
        raise Conflict("AI savoli yangilangan. Suhbatni yangilab, joriy savolga javob bering.")
    pending = list(
        AssistantAssessment.objects.filter(
            message__response_episode_id=message.response_episode_id,
            reply_at__isnull=True,
            suppressed_at__isnull=True,
        )
        .select_related("message")
        .order_by("created_at", "id")
    )
    if response_to and pending:
        raise Conflict("Yangi xabar mavjud. Joriy suhbatni yangilang.")
    context = (
        {"risk": previous.risk, "question": previous.question, "context": previous.context}
        if previous
        else None
    )
    # An unanswered emergency must not be downgraded when the question context expires.
    if EmergencyIncident.objects.filter(episode_id=message.response_episode_id).exists():
        context = {**(context or {}), "risk": "EMERGENCY"}
    status = getattr(message, "patientstatusupdate", None)
    text = "\n".join([row.message.text for row in pending[-9:]] + [message.text])
    result = assess(text, context, status.self_reported_state if status else None)
    due = min(
        (row.reply_due_at for row in pending if row.reply_due_at),
        default=message.sent_at + timedelta(seconds=60),
    )
    if pending:
        AssistantAssessment.objects.filter(pk__in=[row.pk for row in pending]).update(
            suppressed_at=timezone.now(), reply_reason="SUPERSEDED"
        )
    assessment = AssistantAssessment.objects.create(
        message=message,
        risk=result.risk,
        reply=result.reply,
        reasons=result.reasons,
        question=result.question,
        context=result.context,
        reply_due_at=due,
    )
    if assessment.risk == AssistantAssessment.Risk.EMERGENCY:
        incident, created = EmergencyIncident.objects.get_or_create(
            episode_id=message.response_episode_id,
            defaults={"assessment": assessment, "reference": "DEMO-" + str(assessment.id).upper()},
        )
        assessment.incident = incident
        assessment.save(update_fields=["incident"])
        if created:
            for kind, detail in [
                ("DETECTED", "Demo yordamchi shoshilinch belgini ajratdi."),
                (
                    "DEMO_CALL_SIMULATED",
                    "Demo: 103 qo‘ng‘irog‘i simulyatsiya qilindi. Haqiqiy qo‘ng‘iroq bajarilmadi.",
                ),
                (
                    "STAFF_NOTIFIED",
                    "Mas’ul shifokor va hudud koordinatorlariga ichki ogohlantirish yaratildi.",
                ),
            ]:
                EmergencyEvent.objects.create(incident=incident, kind=kind, detail=detail)
            recipients = list(patient_coordinators(message.conversation.patient))
            recipients.extend(team_doctors(message.conversation.patient_id))
            enqueue(
                None,
                "AI_EMERGENCY_ALERT",
                recipients,
                episode=message.response_episode,
                dedupe_prefix=str(incident.id),
                conversation=message.conversation,
            )
            audit(message.sender, incident, "DEMO_EMERGENCY_CREATED")
    audit(message.sender, assessment, "DEMO_ASSISTANT_ASSESSED", ["risk", "engine_version"])
    if assessment.risk == AssistantAssessment.Risk.EMERGENCY:
        publish_assessment(assessment, "EMERGENCY")
    elif not team_online(message.conversation.patient_id):
        publish_assessment(assessment, "DOCTORS_OFFLINE")
    return assessment


def publish_assessment(assessment, reason):
    if assessment.reply_at or assessment.suppressed_at:
        return False
    assessment.reply_at, assessment.reply_reason = timezone.now(), reason
    assessment.save(update_fields=["reply_at", "reply_reason"])
    message = assessment.message
    recipients = User.objects.filter(
        patient_id=message.conversation.patient_id, role=Role.PATIENT, is_active=True
    )
    enqueue(
        None,
        "AI_ASSISTANT_REPLY",
        recipients,
        episode=message.response_episode,
        dedupe_prefix=str(assessment.pk),
        conversation=message.response_episode.conversation,
    )
    audit(message.sender, assessment, "DEMO_ASSISTANT_REPLY_PUBLISHED", ["reply_reason"])
    return True


@transaction.atomic
def release_pending_assessment(pk):
    row = (
        AssistantAssessment.objects.filter(pk=pk)
        .values("message__conversation__patient_id")
        .first()
    )
    if not row:
        return False
    Patient.objects.select_for_update().get(pk=row["message__conversation__patient_id"])
    assessment = (
        AssistantAssessment.objects.select_for_update(of=("self",))
        .select_related(
            "message__conversation__patient",
            "message__response_episode__conversation",
            "message__sender",
        )
        .get(pk=pk)
    )
    if assessment.reply_at or assessment.suppressed_at or not assessment.reply_due_at:
        return False
    if not assistant_enabled() or assessment.message.response_episode.responded_at:
        assessment.suppressed_at = timezone.now()
        assessment.reply_reason = (
            "DOCTOR_REPLIED" if assessment.message.response_episode.responded_at else "DISABLED"
        )
        assessment.save(update_fields=["suppressed_at", "reply_reason"])
        return False
    patient_id = assessment.message.conversation.patient_id
    if not team_online(patient_id):
        return publish_assessment(assessment, "DOCTORS_OFFLINE")
    if assessment.reply_due_at <= timezone.now():
        return publish_assessment(assessment, "NO_REPLY_60S")
    return False


@transaction.atomic
def share_location(pk, user, data, request=None):
    if user.role != Role.PATIENT:
        raise PermissionDenied("Lokatsiyani faqat bemorning o‘zi ulashadi.")
    incident = get_object_or_404(incidents_for(user).select_for_update(of=("self",)), pk=pk)
    if incident.created_at < timezone.now() - timedelta(hours=24) and incident.episode.responded_at:
        raise Conflict(
            "Bu SOS yozuvi eski va murojaatga javob berilgan. Joriy holatni suhbatga qayta yozing."
        )
    now = timezone.now()
    if data["source"] == "DEMO":
        if not assistant_enabled():
            raise ValidationError("Namoyish lokatsiyasi faqat demo rejimida ishlaydi.")
        latitude, longitude, accuracy = Decimal("41.311081"), Decimal("69.240562"), None
        recorded = now
    else:
        if (
            data.get("latitude") is None
            or data.get("longitude") is None
            or data.get("recorded_at") is None
        ):
            raise ValidationError("Qurilma koordinatasi va aniqlangan vaqti kerak.")
        latitude, longitude, accuracy = data["latitude"], data["longitude"], data.get("accuracy_m")
        recorded = data["recorded_at"]
        if recorded < now - timedelta(minutes=5) or recorded > now + timedelta(seconds=30):
            raise ValidationError("Lokatsiya eskirgan yoki vaqti noto‘g‘ri. Qayta aniqlang.")
    incident.latitude, incident.longitude, incident.accuracy_m = latitude, longitude, accuracy
    incident.location_source, incident.location_recorded_at = data["source"], recorded
    incident.location_shared_at = incident.location_consent_at = now
    incident.save(
        update_fields=[
            "latitude",
            "longitude",
            "accuracy_m",
            "location_source",
            "location_recorded_at",
            "location_shared_at",
            "location_consent_at",
        ]
    )
    EmergencyEvent.objects.create(
        incident=incident,
        kind="LOCATION_SHARED",
        actor=user,
        detail="Bemor roziligi bilan "
        + ("namoyish" if data["source"] == "DEMO" else "qurilma")
        + " lokatsiyasi ulashildi.",
    )
    audit(user, incident, "EMERGENCY_LOCATION_SHARED", ["location_source"], request)
    return incident


@transaction.atomic
def acknowledge(pk, user, request=None):
    if user.role not in {Role.DOCTOR, Role.COORDINATOR}:
        raise PermissionDenied("Faqat mas’ul tibbiyot xodimi uchun.")
    incident = get_object_or_404(incidents_for(user).select_for_update(of=("self",)), pk=pk)
    if not incident.acknowledged_at:
        incident.acknowledged_at, incident.acknowledged_by = timezone.now(), user
        incident.save(update_fields=["acknowledged_at", "acknowledged_by"])
        EmergencyEvent.objects.create(
            incident=incident,
            kind="STAFF_ACKNOWLEDGED",
            actor=user,
            detail="Tibbiyot xodimi demo SOS yozuvini ko‘rganini tasdiqladi. Bu tez yordam dispetcheri tasdig‘i emas.",
        )
        audit(user, incident, "EMERGENCY_ACKNOWLEDGED", request=request)
    return incident
