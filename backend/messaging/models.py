from django.conf import settings
from django.db import models
from django.db.models import Q

from common.models import UUIDModel


class Conversation(UUIDModel):
    patient = models.ForeignKey("care.Patient", on_delete=models.PROTECT)
    assignment = models.ForeignKey("care.PatientAssignment", null=True, on_delete=models.PROTECT)
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
    status = models.CharField(
        max_length=12, default="OPEN", choices=[("OPEN", "OPEN"), ("CLOSED", "CLOSED")]
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["patient"], condition=Q(status="OPEN"), name="one_open_patient_conversation"
            )
        ]


class Message(UUIDModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.PROTECT, related_name="messages"
    )
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    text = models.TextField()
    sent_at = models.DateTimeField()
    read_at = models.DateTimeField(null=True)
    kind = models.CharField(max_length=16, default="TEXT")
    response_episode = models.ForeignKey(
        "ResponseEpisode", null=True, on_delete=models.PROTECT, related_name="patient_messages"
    )


class PatientStatusUpdate(UUIDModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.PROTECT, related_name="status_updates"
    )
    message = models.OneToOneField(Message, on_delete=models.PROTECT)
    self_reported_state = models.CharField(
        max_length=16,
        choices=[
            ("IMPROVED", "Yaxshilandi"),
            ("UNCHANGED", "O‘zgarmadi"),
            ("WORSENED", "Yomonlashdi"),
        ],
    )
    note = models.TextField()
    observed_at = models.DateTimeField()
    received_at = models.DateTimeField()


class WorkSchedule(UUIDModel):
    organization = models.ForeignKey("care.Organization", on_delete=models.PROTECT)
    doctor = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    timezone = models.CharField(max_length=80, default="Asia/Tashkent")
    shifts = models.JSONField(default=list)
    exceptions = models.JSONField(default=dict)
    version = models.PositiveIntegerField(default=1)


class ResponseEpisode(UUIDModel):
    conversation = models.ForeignKey(
        Conversation, on_delete=models.PROTECT, related_name="episodes"
    )
    first_unanswered_at = models.DateTimeField()
    response_due_at = models.DateTimeField(null=True)
    responded_at = models.DateTimeField(null=True)
    escalation_at = models.DateTimeField(null=True)
    schedule_snapshot = models.JSONField(default=dict)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation"],
                condition=Q(responded_at__isnull=True),
                name="one_unanswered_conversation_episode",
            )
        ]


class AssistantAssessment(UUIDModel):
    class Risk(models.TextChoices):
        EMERGENCY = "EMERGENCY", "Shoshilinch belgi"
        DOCTOR_REVIEW = "DOCTOR_REVIEW", "Shifokor tekshiruvi kerak"
        SELF_MONITOR = "SELF_MONITOR", "Kuzatuvni davom ettiring"
        NEEDS_INFO = "NEEDS_INFO", "Qo‘shimcha ma’lumot kerak"

    message = models.OneToOneField(
        Message, on_delete=models.PROTECT, related_name="assistant_assessment"
    )
    risk = models.CharField(max_length=20, choices=Risk.choices)
    reply = models.TextField()
    reasons = models.JSONField(default=list)
    question = models.JSONField(default=dict)
    context = models.JSONField(default=dict)
    mode = models.CharField(max_length=12, default="DEMO")
    engine_version = models.CharField(max_length=40, default="uz-triage-demo-v1")
    incident = models.ForeignKey(
        "EmergencyIncident", null=True, on_delete=models.PROTECT, related_name="assessments"
    )


class EmergencyIncident(UUIDModel):
    assessment = models.OneToOneField(
        AssistantAssessment, on_delete=models.PROTECT, related_name="emergency"
    )
    episode = models.OneToOneField(
        ResponseEpisode, on_delete=models.PROTECT, related_name="emergency_incident"
    )
    # Only a simulator exists. There is no ambulance dispatch transport here.
    state = models.CharField(max_length=32, default="DEMO_SIMULATED")
    emergency_number = models.CharField(max_length=8, default="103")
    demo = models.BooleanField(default=True)
    reference = models.CharField(max_length=50, unique=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True)
    accuracy_m = models.FloatField(null=True)
    location_source = models.CharField(max_length=12, blank=True)
    location_recorded_at = models.DateTimeField(null=True)
    location_shared_at = models.DateTimeField(null=True)
    location_consent_at = models.DateTimeField(null=True)
    acknowledged_at = models.DateTimeField(null=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT
    )


class EmergencyEvent(UUIDModel):
    incident = models.ForeignKey(EmergencyIncident, on_delete=models.PROTECT, related_name="events")
    kind = models.CharField(max_length=40)
    detail = models.CharField(max_length=300)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT)
