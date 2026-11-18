from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import UUIDModel


class Territory(UUIDModel):
    name = models.CharField(max_length=200)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT)

    def __str__(self):
        return self.name


class Organization(UUIDModel):
    class Type(models.TextChoices):
        HOSPITAL = "HOSPITAL", "Statsionar"
        CLINIC = "CLINIC", "Poliklinika"

    name = models.CharField(max_length=200)
    type = models.CharField(max_length=12, choices=Type.choices)
    territory = models.ForeignKey(Territory, on_delete=models.PROTECT)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Patient(UUIDModel):
    created_by_org = models.ForeignKey(Organization, on_delete=models.PROTECT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_patients"
    )
    full_name = models.CharField(max_length=250)
    birth_date = models.DateField()
    address = models.TextField()
    territory = models.ForeignKey(Territory, on_delete=models.PROTECT)
    contact = models.CharField(max_length=20, blank=True)
    contact_is_representative = models.BooleanField(default=False)
    no_phone_reason = models.CharField(max_length=250, blank=True)


class PatientAssignment(UUIDModel):
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="assignments")
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    organization = models.ForeignKey(Organization, on_delete=models.PROTECT)
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["patient"],
                condition=Q(valid_to__isnull=True),
                name="one_current_patient_assignment",
            )
        ]


class Discharge(UUIDModel):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Loyiha"
        CONFIRMED = "CONFIRMED", "Tasdiqlangan"

    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="discharges")
    managing_organization = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="managed_discharges")
    hospital = models.ForeignKey(Organization, on_delete=models.PROTECT)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    discharged_at = models.DateTimeField()
    confirmed_at = models.DateTimeField(null=True)
    recommendations = models.TextField()
    follow_up_reason = models.TextField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    source_event_id = models.UUIDField(null=True, blank=True, unique=True)
    replaces = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT)
    patient_snapshot = models.JSONField(default=dict)


class TaskStatus(models.TextChoices):
    UNASSIGNED = "UNASSIGNED", "Mas’ulsiz"
    NEW = "NEW", "Yangi"
    ACCEPTED = "ACCEPTED", "Qabul qilingan"
    COMPLETED = "COMPLETED", "Bajarilgan"
    CANCELLED = "CANCELLED", "Bekor qilingan"


OPEN_STATUSES = [TaskStatus.UNASSIGNED, TaskStatus.NEW, TaskStatus.ACCEPTED]


class CareTask(UUIDModel):
    discharge = models.OneToOneField(Discharge, on_delete=models.PROTECT, related_name="task")
    assigned_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT
    )
    receiving_org = models.ForeignKey(Organization, null=True, on_delete=models.PROTECT)
    service_territory = models.ForeignKey(Territory, on_delete=models.PROTECT)
    status = models.CharField(max_length=12, choices=TaskStatus.choices)
    due_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    version = models.PositiveIntegerField(default=1)
    cancellation_code = models.CharField(max_length=64, blank=True)
    cancellation_note = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.PROTECT,
        related_name="cancelled_tasks",
    )
    cancelled_at = models.DateTimeField(null=True)
    is_test = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["status", "due_at"]),
            models.Index(fields=["assigned_doctor", "status"]),
            models.Index(fields=["receiving_org", "status"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(status="UNASSIGNED", assigned_doctor__isnull=True)
                    | Q(status__in=["NEW", "ACCEPTED", "COMPLETED"], assigned_doctor__isnull=False)
                    | Q(status="CANCELLED")
                ),
                name="task_assignee_matches_status",
            )
        ]


class AssignmentHistory(UUIDModel):
    task = models.ForeignKey(CareTask, on_delete=models.PROTECT, related_name="assignment_history")
    old_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.PROTECT,
        related_name="previous_assignments",
    )
    new_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="new_assignments"
    )
    reason = models.TextField()
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)


class ContactAttempt(UUIDModel):
    task = models.ForeignKey(CareTask, on_delete=models.PROTECT, related_name="contact_attempts")
    channel = models.CharField(
        max_length=16, choices=[("PHONE", "Telefon"), ("HOME_VISIT", "Uyga tashrif")]
    )
    result = models.CharField(
        max_length=24,
        choices=[
            ("CONTACTED", "Bog‘lanildi"),
            ("NO_ANSWER", "Javobsiz"),
            ("WRONG_NUMBER", "Noto‘g‘ri raqam"),
            ("ADDRESS_NOT_FOUND", "Manzil topilmadi"),
            ("REFUSED", "Rad etdi"),
        ],
    )
    attempted_at = models.DateTimeField()
    note = models.TextField()
    next_action = models.TextField()
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)


class VisitReport(UUIDModel):
    task = models.OneToOneField(CareTask, on_delete=models.PROTECT, related_name="report")
    performed_at = models.DateTimeField()
    channel = models.CharField(max_length=16)
    observation = models.TextField()
    actions = models.TextField()
    follow_up = models.TextField()
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)


class Attachment(UUIDModel):
    discharge = models.ForeignKey(Discharge, on_delete=models.PROTECT, related_name="attachments")
    file = models.FileField(upload_to="epicrises/%Y/%m", max_length=300)
    checksum = models.CharField(max_length=64)
    mime = models.CharField(max_length=80, default="application/pdf")
    size = models.PositiveIntegerField()
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)


class RecordCorrection(UUIDModel):
    discharge = models.ForeignKey(
        Discharge, null=True, on_delete=models.PROTECT, related_name="corrections"
    )
    report = models.ForeignKey(
        VisitReport, null=True, on_delete=models.PROTECT, related_name="corrections"
    )
    field = models.CharField(max_length=32)
    correction_text = models.TextField()
    reason = models.TextField()
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)


class AuditEvent(UUIDModel):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    entity_type = models.CharField(max_length=64)
    entity_id = models.UUIDField(db_index=True)
    action = models.CharField(max_length=64)
    changed_fields = models.JSONField(default=list)
    request_id = models.CharField(max_length=36, blank=True)


class OutboxEvent(UUIDModel):
    task = models.ForeignKey(CareTask, null=True, on_delete=models.PROTECT)
    episode = models.ForeignKey("messaging.ResponseEpisode", null=True, on_delete=models.PROTECT)
    conversation = models.ForeignKey("messaging.Conversation", null=True, on_delete=models.PROTECT)
    event_type = models.CharField(max_length=40)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    dedupe_key = models.CharField(max_length=200, unique=True)
    delivery_status = models.CharField(
        max_length=12,
        default="PENDING",
        choices=[
            ("PENDING", "PENDING"),
            ("DELIVERED", "DELIVERED"),
            ("SKIPPED", "SKIPPED"),
            ("FAILED", "FAILED"),
        ],
    )
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField()


class Notification(UUIDModel):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    task = models.ForeignKey(CareTask, null=True, on_delete=models.PROTECT)
    conversation = models.ForeignKey("messaging.Conversation", null=True, on_delete=models.PROTECT)
    event_type = models.CharField(max_length=40)
    dedupe_key = models.CharField(max_length=200, unique=True)
    read_at = models.DateTimeField(null=True)
    # No clinical text is copied into notifications.


class AIExtraction(UUIDModel):
    discharge = models.ForeignKey(Discharge, on_delete=models.PROTECT)
    attachment = models.ForeignKey(Attachment, null=True, on_delete=models.PROTECT)
    source_text = models.TextField(blank=True)
    status = models.CharField(max_length=20, default="QUEUED")
    structured_result = models.JSONField(default=dict)
    reviewed_result = models.JSONField(default=dict)
    model_version = models.CharField(max_length=64, blank=True)
    is_mock = models.BooleanField(default=True)
    error_code = models.CharField(max_length=64, blank=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    reviewed_at = models.DateTimeField(null=True)
    processed_at = models.DateTimeField(null=True)
    attempts = models.PositiveSmallIntegerField(default=0)
