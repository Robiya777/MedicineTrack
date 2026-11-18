from celery import shared_task
from django.db import transaction
from django.utils import timezone

from care.services import audit

from .models import MedicationPlan, PlanStatus
from .services import lock_context


@shared_task
def complete_courses():
    now = timezone.now()
    candidates = list(
        MedicationPlan.objects.filter(status=PlanStatus.ACTIVE, ends_at__lte=now).values(
            "id", "discharge_id", "patient_id"
        )
    )
    completed = 0
    for row in candidates:
        with transaction.atomic():
            lock_context(row["discharge_id"], row["patient_id"])
            plan = MedicationPlan.objects.select_for_update().get(pk=row["id"])
            if plan.status != PlanStatus.ACTIVE or plan.ends_at > now:
                continue
            plan.status, plan.completed_at = PlanStatus.COMPLETED, now
            plan.lock_version += 1
            plan.save(update_fields=["status", "completed_at", "lock_version", "updated_at"])
            audit(None, plan, "MEDICATION_COURSE_COMPLETED")
            completed += 1
    return completed
