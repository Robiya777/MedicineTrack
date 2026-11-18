from celery import shared_task
from django.db import transaction
from django.utils import timezone

from care.services import enqueue

from .models import AssistantAssessment, ResponseEpisode
from .services import patient_coordinators


@shared_task
def release_assistant_replies():
    from .assistant import release_pending_assessment

    ids = list(
        AssistantAssessment.objects.filter(
            reply_at__isnull=True, suppressed_at__isnull=True, reply_due_at__isnull=False
        )
        .order_by("reply_due_at", "id")
        .values_list("id", flat=True)[:100]
    )
    return sum(release_pending_assessment(pk) for pk in ids)


@shared_task
def scan_responses():
    now = timezone.now()
    ids = list(
        ResponseEpisode.objects.filter(
            responded_at__isnull=True, response_due_at__lt=now, escalation_at__isnull=True
        ).values_list("id", flat=True)
    )
    for pk in ids:
        with transaction.atomic():
            episode = (
                ResponseEpisode.objects.select_for_update()
                .select_related("conversation__patient")
                .get(pk=pk)
            )
            if episode.responded_at or episode.escalation_at:
                continue
            enqueue(
                None,
                "RESPONSE_OVERDUE",
                patient_coordinators(episode.conversation.patient),
                episode=episode,
            )
            episode.escalation_at = now
            episode.save(update_fields=["escalation_at"])
    return len(ids)
