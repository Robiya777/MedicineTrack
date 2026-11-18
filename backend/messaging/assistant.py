"""Patient-owned demo assistant and consented emergency location sharing."""

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import Role
from care.scopes import active_assignments
from care.services import audit, enqueue
from common.exceptions import Conflict

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
        return rows.filter(
            **{patient + "__in": active_assignments().filter(doctor=user).values("patient_id")}
        )
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
            created_at__gte=timezone.now() - timedelta(minutes=30),
        )
        .order_by("-created_at", "-id")
        .first()
    )
    if response_to and (not previous or previous.pk != response_to):
        raise Conflict("AI savoli yangilangan. Suhbatni yangilab, joriy savolga javob bering.")
    context = (
        {"risk": previous.risk, "question": previous.question, "context": previous.context}
        if previous
        else None
    )
    # An unanswered emergency must not be downgraded when the question context expires.
    if EmergencyIncident.objects.filter(episode_id=message.response_episode_id).exists():
        context = {**(context or {}), "risk": "EMERGENCY"}
    status = getattr(message, "patientstatusupdate", None)
    result = assess(message.text, context, status.self_reported_state if status else None)
    assessment = AssistantAssessment.objects.create(
        message=message,
        risk=result.risk,
        reply=result.reply,
        reasons=result.reasons,
        question=result.question,
        context=result.context,
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
            if message.conversation.doctor_id:
                recipients.append(message.conversation.doctor)
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
    return assessment


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
