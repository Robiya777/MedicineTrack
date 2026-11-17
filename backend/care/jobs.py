from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import Role

from .ai import extract_mock
from .models import OPEN_STATUSES, AIExtraction, CareTask, Notification, OutboxEvent
from .scopes import tasks_for
from .services import enqueue, task_coordinators


@shared_task
def scan_deadlines():
    now = timezone.now()
    ids = list(CareTask.objects.filter(status__in=OPEN_STATUSES).values_list("id", flat=True))
    for pk in ids:
        with transaction.atomic():
            task = CareTask.objects.select_for_update().select_related("discharge").get(pk=pk)
            if task.status not in OPEN_STATUSES:
                continue
            if now > task.due_at:
                enqueue(task, "TASK_OVERDUE", task_coordinators(task))
                continue
            for hours in [20, 12]:
                threshold = task.discharge.discharged_at + timedelta(hours=hours)
                if now >= threshold:
                    if task.discharge.confirmed_at <= threshold:
                        recipients = (
                            [task.assigned_doctor]
                            if task.assigned_doctor_id
                            else task_coordinators(task)
                        )
                        enqueue(task, f"TASK_REMINDER_{hours}", recipients)
                    break
    return len(ids)


def event_is_current(event):
    if not event.recipient.is_active:
        return False
    if event.task_id:
        task = event.task
        if task.status not in OPEN_STATUSES:
            return False
        if event.recipient.role == Role.DOCTOR and task.assigned_doctor_id != event.recipient_id:
            return False
        if (
            event.recipient.role == Role.COORDINATOR
            and not tasks_for(event.recipient).filter(pk=task.pk).exists()
        ):
            return False
    if event.conversation_id and event.recipient.role == Role.DOCTOR:
        from messaging.services import conversations_for

        if not conversations_for(event.recipient).filter(pk=event.conversation_id).exists():
            return False
    if event.episode_id and event.event_type in {"RESPONSE_OVERDUE", "RESPONSE_SCHEDULE_MISSING"}:
        if event.episode.responded_at:
            return False
    return True


@shared_task
def deliver_outbox():
    now = timezone.now()
    ids = list(
        OutboxEvent.objects.filter(delivery_status="PENDING", next_attempt_at__lte=now).values_list(
            "id", flat=True
        )[:500]
    )
    for pk in ids:
        with transaction.atomic():
            event = OutboxEvent.objects.select_for_update().get(pk=pk)
            if event.delivery_status != "PENDING" or event.next_attempt_at > timezone.now():
                continue
            try:
                with transaction.atomic():
                    if not event_is_current(event):
                        event.delivery_status = "SKIPPED"
                    else:
                        Notification.objects.get_or_create(
                            dedupe_key=event.dedupe_key,
                            defaults={
                                "task_id": event.task_id,
                                "conversation_id": event.conversation_id,
                                "recipient_id": event.recipient_id,
                                "event_type": event.event_type,
                            },
                        )
                        event.delivery_status = "DELIVERED"
            except Exception:
                # No clinical payload or raw exception is written to ordinary logs.
                event.attempts += 1
                if event.attempts <= 3:
                    event.next_attempt_at = now + timedelta(minutes=[1, 5, 15][event.attempts - 1])
                else:
                    event.delivery_status = "FAILED"
            event.save(update_fields=["delivery_status", "attempts", "next_attempt_at"])
    return len(ids)


@shared_task
def process_extractions():
    # A hard-killed worker leaves a claim that can be recovered once.
    stale = AIExtraction.objects.filter(
        status="PROCESSING", processed_at__lt=timezone.now() - timedelta(seconds=45)
    )
    stale.filter(attempts__lt=2).update(status="QUEUED")
    stale.filter(attempts__gte=2).update(status="FAILED", error_code="TIMEOUT")
    ids = list(AIExtraction.objects.filter(status="QUEUED").values_list("id", flat=True)[:100])
    for pk in ids:
        extract_document.delay(str(pk))
    return len(ids)


@shared_task(soft_time_limit=30, time_limit=40)
def extract_document(pk):
    with transaction.atomic():
        extraction = AIExtraction.objects.select_for_update().get(pk=pk)
        if extraction.status != "QUEUED":
            return
        extraction.status = "PROCESSING"
        extraction.attempts += 1
        extraction.processed_at = timezone.now()
        extraction.save(update_fields=["status", "attempts", "processed_at"])
    try:
        if settings.AI_MODE != "mock":
            raise ValueError("AI_DISABLED")
        result = extract_mock(extraction)
        AIExtraction.objects.filter(pk=pk).update(
            status="PENDING_REVIEW",
            structured_result=result,
            model_version="demo-extractive-v1",
            is_mock=True,
            processed_at=timezone.now(),
            error_code="",
        )
    except ValueError as exc:
        error = (
            str(exc)
            if str(exc) in {"TEXT_NOT_FOUND", "PDF_PAGE_LIMIT", "AI_DISABLED"}
            else "EXTRACTION_FAILED"
        )
        AIExtraction.objects.filter(pk=pk).update(
            status="FAILED", error_code=error, processed_at=timezone.now()
        )
    except Exception:
        AIExtraction.objects.filter(pk=pk).update(
            status="QUEUED" if extraction.attempts < 2 else "FAILED",
            error_code="EXTRACTION_FAILED",
            processed_at=timezone.now(),
        )
