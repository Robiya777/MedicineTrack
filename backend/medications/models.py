import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import UUIDModel


class PlanStatus(models.TextChoices):
    DRAFT = "DRAFT", "Loyiha"
    ACTIVE = "ACTIVE", "Faol"
    COMPLETED = "COMPLETED", "Kurs tugagan"
    STOPPED = "STOPPED", "To‘xtatilgan"


class MedicationPlan(UUIDModel):
    patient = models.ForeignKey("care.Patient", on_delete=models.PROTECT)
    discharge = models.ForeignKey("care.Discharge", on_delete=models.PROTECT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_medication_plans"
    )
    series_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    version = models.PositiveIntegerField(default=1)
    lock_version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=12, choices=PlanStatus.choices, default=PlanStatus.DRAFT)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.PROTECT,
        related_name="approved_medication_plans",
    )
    approved_at = models.DateTimeField(null=True)
    supersedes = models.ForeignKey(
        "self", null=True, on_delete=models.PROTECT, related_name="revisions"
    )
    stopped_at = models.DateTimeField(null=True)
    stopped_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.PROTECT,
        related_name="stopped_medication_plans",
    )
    stop_reason = models.TextField(blank=True)
    ends_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["series_id", "version"], name="medication_series_version_unique"
            ),
            models.UniqueConstraint(
                fields=["series_id"],
                condition=Q(status="ACTIVE"),
                name="one_active_medication_series_version",
            ),
            models.UniqueConstraint(
                fields=["supersedes"],
                condition=Q(status="DRAFT"),
                name="one_draft_medication_revision",
            ),
            models.CheckConstraint(
                condition=Q(status="DRAFT", approved_by__isnull=True, approved_at__isnull=True)
                | Q(
                    status__in=["ACTIVE", "COMPLETED", "STOPPED"],
                    approved_by__isnull=False,
                    approved_at__isnull=False,
                ),
                name="medication_approval_matches_status",
            ),
        ]
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["status", "ends_at"]),
        ]


class MedicationItem(UUIDModel):
    plan = models.ForeignKey(MedicationPlan, on_delete=models.PROTECT, related_name="items")
    name = models.CharField(max_length=250, null=True, blank=True)
    prescribed_dose_text = models.TextField(null=True, blank=True)
    route = models.CharField(max_length=80, null=True, blank=True)
    instructions = models.TextField(blank=True)
    source_reference = models.TextField(blank=True)
    start_date = models.DateField(null=True)
    end_date = models.DateField(null=True)
    timezone = models.CharField(max_length=80, blank=True)
    local_times = models.JSONField(default=list)
    needs_clarification = models.BooleanField(default=False)
    clarification_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["created_at", "id"]


class DoseOccurrence(UUIDModel):
    item = models.ForeignKey(MedicationItem, on_delete=models.PROTECT, related_name="occurrences")
    plan_version = models.PositiveIntegerField()
    scheduled_at = models.DateTimeField(db_index=True)
    cancelled_at = models.DateTimeField(null=True)
    cancellation_reason = models.CharField(max_length=24, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["item", "plan_version", "scheduled_at"],
                name="dose_item_version_time_unique",
            )
        ]
        ordering = ["scheduled_at", "id"]


class DoseResult(models.TextChoices):
    TAKEN = "TAKEN", "Ichdim"
    SKIPPED = "SKIPPED", "O‘tkazib yubordim"


class DoseRecord(UUIDModel):
    occurrence = models.OneToOneField(
        DoseOccurrence, on_delete=models.PROTECT, related_name="record"
    )
    patient_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    result = models.CharField(max_length=8, choices=DoseResult.choices)
    reported_taken_at = models.DateTimeField(null=True)
    client_recorded_at = models.DateTimeField()
    server_received_at = models.DateTimeField()
    note = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=1)
    recorded_against_inactive_plan = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(result="TAKEN", reported_taken_at__isnull=False)
                | Q(result="SKIPPED", reported_taken_at__isnull=True),
                name="dose_result_taken_time_matches",
            )
        ]


class DoseRecordCorrection(UUIDModel):
    record = models.ForeignKey(DoseRecord, on_delete=models.PROTECT, related_name="corrections")
    version = models.PositiveIntegerField()
    result = models.CharField(max_length=8, choices=DoseResult.choices)
    reported_taken_at = models.DateTimeField(null=True)
    client_recorded_at = models.DateTimeField()
    note = models.TextField(blank=True)
    reason = models.TextField()
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        ordering = ["version"]
        constraints = [
            models.UniqueConstraint(
                fields=["record", "version"], name="dose_correction_version_unique"
            ),
            models.CheckConstraint(
                condition=Q(result="TAKEN", reported_taken_at__isnull=False)
                | Q(result="SKIPPED", reported_taken_at__isnull=True),
                name="dose_correction_taken_time_matches",
            ),
        ]
