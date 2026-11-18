import re

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User

from .models import (
    AIExtraction,
    Attachment,
    AuditEvent,
    CareTask,
    ContactAttempt,
    Discharge,
    Notification,
    Organization,
    Patient,
    RecordCorrection,
    Territory,
    VisitReport,
)
from .scopes import is_hospital_staff


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            "id",
            "full_name",
            "birth_date",
            "address",
            "territory",
            "contact",
            "contact_is_representative",
            "no_phone_reason",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_birth_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("Tug‘ilgan sana kelajakda bo‘lmaydi.")
        return value

    def validate(self, attrs):
        contact = attrs.get("contact", getattr(self.instance, "contact", ""))
        reason = attrs.get("no_phone_reason", getattr(self.instance, "no_phone_reason", ""))
        if contact and not re.fullmatch(r"\+[1-9]\d{7,14}", contact):
            raise serializers.ValidationError(
                {"contact": "E.164 shakli kerak, masalan +998901234567."}
            )
        if not contact and not reason.strip():
            raise serializers.ValidationError(
                {"no_phone_reason": "Telefon yoki telefon yo‘qligi sababini kiriting."}
            )
        if self.instance and set(attrs) - {
            "contact",
            "address",
            "contact_is_representative",
            "no_phone_reason",
        }:
            raise serializers.ValidationError(
                "Faqat kontakt va manzil maydonlarini tahrirlash mumkin."
            )
        return attrs


class DischargeSerializer(serializers.ModelSerializer):
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = Discharge
        fields = [
            "id",
            "patient",
            "hospital",
            "discharged_at",
            "confirmed_at",
            "recommendations",
            "follow_up_reason",
            "status",
            "source_event_id",
            "replaces",
            "patient_snapshot",
            "created_at",
            "attachments",
        ]
        read_only_fields = [
            "id",
            "hospital",
            "confirmed_at",
            "status",
            "patient_snapshot",
            "created_at",
        ]

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        fields["patient"].queryset = (
            Patient.objects.filter(created_by_org_id=request.user.organization_id)
            if request and request.user.is_authenticated and is_hospital_staff(request.user)
            else Patient.objects.none()
        )
        fields["replaces"].queryset = (
            Discharge.objects.filter(created_by=request.user, task__status="CANCELLED")
            if request and request.user.is_authenticated
            else Discharge.objects.none()
        )
        return fields

    def get_attachments(self, obj) -> list:
        return AttachmentSerializer(obj.attachments.all(), many=True).data

    def validate(self, attrs):
        if self.instance and "patient" in attrs and attrs["patient"].pk != self.instance.patient_id:
            raise serializers.ValidationError(
                {"patient": "Chiqarish bemorini almashtirish mumkin emas."}
            )
        return attrs


class ContactAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactAttempt
        fields = [
            "id",
            "channel",
            "result",
            "attempted_at",
            "note",
            "next_action",
            "actor",
            "created_at",
        ]
        read_only_fields = ["id", "actor", "created_at"]


class ContactAttemptInput(ContactAttemptSerializer):
    version = serializers.IntegerField(min_value=1, write_only=True)

    class Meta(ContactAttemptSerializer.Meta):
        fields = [*ContactAttemptSerializer.Meta.fields, "version"]


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = VisitReport
        fields = [
            "id",
            "performed_at",
            "channel",
            "observation",
            "actions",
            "follow_up",
            "author",
            "created_at",
        ]
        read_only_fields = fields


class CompleteInput(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)
    performed_at = serializers.DateTimeField()
    channel = serializers.ChoiceField(choices=ContactAttempt._meta.get_field("channel").choices)
    observation = serializers.CharField()
    actions = serializers.CharField()
    follow_up = serializers.CharField()

    def validate_channel(self, value):
        if value not in settings.COMPLETION_CHANNELS:
            raise serializers.ValidationError("Bu yakunlash kanali sozlamalarda o‘chirilgan.")
        return value


class VersionInput(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)


class ReassignInput(VersionInput):
    doctor_id = serializers.UUIDField()
    reason = serializers.CharField()


class CancelInput(VersionInput):
    reason_code = serializers.CharField(max_length=64)
    reason = serializers.CharField()


class CorrectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecordCorrection
        fields = ["id", "field", "correction_text", "reason", "actor", "created_at"]
        read_only_fields = ["id", "actor", "created_at"]


class TimelineSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = ["id", "action", "actor", "changed_fields", "created_at"]


class TaskSerializer(serializers.ModelSerializer):
    patient = serializers.JSONField(source="discharge.patient_snapshot", read_only=True)
    recommendations = serializers.CharField(source="discharge.recommendations", read_only=True)
    discharged_at = serializers.DateTimeField(source="discharge.discharged_at", read_only=True)
    overdue = serializers.SerializerMethodField()
    late_documented = serializers.SerializerMethodField()
    report = ReportSerializer(read_only=True)
    contact_attempts = ContactAttemptSerializer(many=True, read_only=True)
    corrections = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()
    first_contact_delay_seconds = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()

    class Meta:
        model = CareTask
        fields = [
            "id",
            "discharge",
            "patient",
            "recommendations",
            "discharged_at",
            "assigned_doctor",
            "receiving_org",
            "status",
            "due_at",
            "accepted_at",
            "completed_at",
            "version",
            "overdue",
            "late_documented",
            "report",
            "contact_attempts",
            "corrections",
            "timeline",
            "first_contact_delay_seconds",
            "attachments",
            "cancellation_code",
            "cancellation_note",
            "cancelled_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_overdue(self, obj) -> bool:
        return obj.status in {"UNASSIGNED", "NEW", "ACCEPTED"} and timezone.now() > obj.due_at

    def get_first_contact_delay_seconds(self, obj) -> float | None:
        attempts = list(obj.contact_attempts.all())
        if not attempts:
            return None
        return (
            min(item.attempted_at for item in attempts) - obj.discharge.discharged_at
        ).total_seconds()

    def get_attachments(self, obj) -> list:
        return AttachmentSerializer(obj.discharge.attachments.all(), many=True).data

    def get_late_documented(self, obj) -> bool:
        report = getattr(obj, "report", None)
        return bool(
            report
            and obj.completed_at
            and obj.completed_at > obj.due_at
            and report.performed_at <= obj.due_at
        )

    def get_corrections(self, obj) -> list:
        from django.db.models import Q

        return CorrectionSerializer(
            RecordCorrection.objects.filter(
                Q(discharge=obj.discharge) | Q(report__task=obj)
            ).order_by("created_at"),
            many=True,
        ).data

    def get_timeline(self, obj) -> list:
        return TimelineSerializer(
            AuditEvent.objects.filter(entity_id__in=[obj.pk, obj.discharge_id]).order_by(
                "created_at"
            ),
            many=True,
        ).data


class AttachmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ["id", "discharge", "checksum", "mime", "size", "created_at", "download_url"]
        read_only_fields = fields

    def get_download_url(self, obj) -> str:
        return f"/api/v1/attachments/{obj.pk}/download"


class UploadInput(serializers.Serializer):
    file = serializers.FileField()


class ExtractionInput(serializers.Serializer):
    attachment_id = serializers.UUIDField(required=False)
    text = serializers.CharField(required=False, max_length=100000)

    def validate(self, attrs):
        if bool(attrs.get("attachment_id")) == bool(attrs.get("text")):
            raise serializers.ValidationError(
                "attachment_id yoki text maydonidan bittasini yuboring."
            )
        return attrs


class ExtractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIExtraction
        fields = [
            "id",
            "discharge",
            "status",
            "structured_result",
            "reviewed_result",
            "model_version",
            "is_mock",
            "error_code",
            "processed_at",
            "reviewed_by",
            "reviewed_at",
            "created_at",
        ]
        read_only_fields = fields


class AIReviewInput(serializers.Serializer):
    summary = serializers.CharField(allow_null=True, allow_blank=True)
    diagnosis_text = serializers.CharField(allow_null=True, allow_blank=True)
    recommendations = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    follow_up_text = serializers.CharField(allow_null=True, allow_blank=True)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "task", "conversation", "event_type", "read_at", "created_at"]
        read_only_fields = fields


class TerritorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Territory
        fields = ["id", "name", "parent"]


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name", "type", "territory", "active"]


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "organization", "is_active"]
        read_only_fields = fields
