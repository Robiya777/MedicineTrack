from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers

from .models import (
    DoseOccurrence,
    DoseRecord,
    DoseRecordCorrection,
    DoseResult,
    MedicationItem,
    MedicationPlan,
    PlanStatus,
)


class AwareDateTimeField(serializers.DateTimeField):
    def to_internal_value(self, value):
        if isinstance(value, str):
            try:
                parsed = parse_datetime(value)
            except ValueError:
                parsed = None
            if parsed is None or timezone.is_naive(parsed):
                raise serializers.ValidationError("Vaqt zonasi bilan ISO-8601 vaqt kiriting.")
        return super().to_internal_value(value)


class MedicationItemSerializer(serializers.ModelSerializer):
    schedule_type = serializers.ChoiceField(choices=["FIXED_TIMES"], default="FIXED_TIMES")
    local_times = serializers.ListField(
        child=serializers.TimeField(format="%H:%M", input_formats=["%H:%M"]),
        max_length=8,
        required=False,
    )
    missing_fields = serializers.SerializerMethodField()

    class Meta:
        model = MedicationItem
        fields = [
            "id",
            "name",
            "prescribed_dose_text",
            "route",
            "instructions",
            "source_reference",
            "start_date",
            "end_date",
            "timezone",
            "local_times",
            "schedule_type",
            "needs_clarification",
            "clarification_reason",
            "missing_fields",
        ]
        read_only_fields = ["id", "missing_fields"]
        extra_kwargs = {
            "prescribed_dose_text": {"max_length": 4000},
            "instructions": {"max_length": 4000},
            "source_reference": {"max_length": 4000},
            "clarification_reason": {"max_length": 4000},
        }

    def get_missing_fields(self, obj) -> list:
        return [
            field
            for field in [
                "name",
                "prescribed_dose_text",
                "route",
                "source_reference",
                "start_date",
                "end_date",
                "timezone",
                "local_times",
            ]
            if not getattr(obj, field)
        ]

    def validate_timezone(self, value):
        if value:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError) as exc:
                raise serializers.ValidationError("IANA vaqt zonasini kiriting.") from exc
        return value

    def validate(self, attrs):
        attrs.pop("schedule_type", None)
        if "local_times" in attrs:
            values = [value.isoformat(timespec="minutes") for value in attrs["local_times"]]
            if len(values) != len(set(values)):
                raise serializers.ValidationError({"local_times": "Bir xil vaqtni takrorlamang."})
            attrs["local_times"] = sorted(values)
        start, end = attrs.get("start_date"), attrs.get("end_date")
        if end == date.max or (start and end and (end < start or (end - start).days >= 90)):
            raise serializers.ValidationError({"end_date": "Kurs 1–90 kun bo‘lishi kerak."})
        return attrs


class PlanCreateInput(serializers.Serializer):
    discharge_id = serializers.UUIDField()
    items = MedicationItemSerializer(many=True, max_length=20, default=list)


class PlanVersionInput(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)
    lock_version = serializers.IntegerField(min_value=1)


class PlanUpdateInput(PlanVersionInput):
    items = MedicationItemSerializer(many=True, max_length=20, required=False)


class PlanStopInput(PlanVersionInput):
    reason = serializers.CharField(max_length=4000)


class MedicationPlanSerializer(serializers.ModelSerializer):
    items = MedicationItemSerializer(many=True, read_only=True)

    class Meta:
        model = MedicationPlan
        fields = [
            "id",
            "patient",
            "discharge",
            "series_id",
            "version",
            "lock_version",
            "status",
            "items",
            "created_by",
            "approved_by",
            "approved_at",
            "supersedes",
            "stopped_at",
            "stopped_by",
            "stop_reason",
            "ends_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DoseRecordInput(serializers.Serializer):
    plan_version = serializers.IntegerField(min_value=1)
    result = serializers.ChoiceField(choices=DoseResult.choices)
    reported_taken_at = AwareDateTimeField(allow_null=True, required=False, default=None)
    client_recorded_at = AwareDateTimeField()
    note = serializers.CharField(max_length=4000, allow_blank=True, required=False, default="")

    def validate(self, attrs):
        if (attrs["result"] == DoseResult.TAKEN) != (attrs["reported_taken_at"] is not None):
            raise serializers.ValidationError(
                {"reported_taken_at": "TAKEN uchun vaqt majburiy; SKIPPED uchun null."}
            )
        return attrs


class DoseCorrectionInput(DoseRecordInput):
    version = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(max_length=4000)


class DoseCorrectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoseRecordCorrection
        fields = [
            "id",
            "version",
            "result",
            "reported_taken_at",
            "client_recorded_at",
            "note",
            "reason",
            "actor",
            "created_at",
        ]
        read_only_fields = fields


def current_values(record):
    corrections = list(record.corrections.all())
    return corrections[-1] if corrections else record


class DoseRecordSerializer(serializers.ModelSerializer):
    result = serializers.SerializerMethodField()
    reported_taken_at = serializers.SerializerMethodField()
    client_recorded_at = serializers.SerializerMethodField()
    note = serializers.SerializerMethodField()
    original = serializers.SerializerMethodField()
    patient_reported = serializers.BooleanField(default=True, read_only=True)
    late_recorded = serializers.SerializerMethodField()
    recording_delay_seconds = serializers.SerializerMethodField()
    sync_delay_seconds = serializers.SerializerMethodField()
    corrections = DoseCorrectionSerializer(many=True, read_only=True)

    class Meta:
        model = DoseRecord
        fields = [
            "id",
            "occurrence",
            "patient_user",
            "result",
            "reported_taken_at",
            "client_recorded_at",
            "server_received_at",
            "note",
            "version",
            "patient_reported",
            "late_recorded",
            "recording_delay_seconds",
            "sync_delay_seconds",
            "recorded_against_inactive_plan",
            "original",
            "corrections",
        ]
        read_only_fields = fields

    def get_result(self, obj) -> str:
        return current_values(obj).result

    def get_reported_taken_at(self, obj) -> str | None:
        value = current_values(obj).reported_taken_at
        return value.isoformat() if value else None

    def get_client_recorded_at(self, obj) -> str:
        return current_values(obj).client_recorded_at.isoformat()

    def get_note(self, obj) -> str:
        return current_values(obj).note

    def get_original(self, obj) -> dict:
        return {
            "result": obj.result,
            "reported_taken_at": obj.reported_taken_at.isoformat()
            if obj.reported_taken_at
            else None,
            "client_recorded_at": obj.client_recorded_at.isoformat(),
            "note": obj.note,
        }

    def get_recording_delay_seconds(self, obj) -> float:
        value = current_values(obj)
        event_time = value.reported_taken_at or obj.occurrence.scheduled_at
        return max(0.0, (value.client_recorded_at - event_time).total_seconds())

    def get_late_recorded(self, obj) -> bool:
        return self.get_recording_delay_seconds(obj) > 0

    def get_sync_delay_seconds(self, obj) -> float:
        value = current_values(obj)
        received_at = obj.server_received_at if value is obj else value.created_at
        return max(0.0, (received_at - value.client_recorded_at).total_seconds())


class DoseOccurrenceSerializer(serializers.ModelSerializer):
    item_details = MedicationItemSerializer(source="item", read_only=True)
    plan_id = serializers.UUIDField(source="item.plan_id", read_only=True)
    plan_status = serializers.CharField(source="item.plan.status", read_only=True)
    record = DoseRecordSerializer(read_only=True)
    status = serializers.SerializerMethodField()
    reminder_enabled = serializers.SerializerMethodField()

    class Meta:
        model = DoseOccurrence
        fields = [
            "id",
            "item",
            "item_details",
            "plan_id",
            "plan_version",
            "plan_status",
            "scheduled_at",
            "cancelled_at",
            "cancellation_reason",
            "reminder_enabled",
            "status",
            "record",
        ]
        read_only_fields = fields

    def get_status(self, obj) -> str:
        if not self.context.get("include_records", True):
            return "NOT_AVAILABLE"
        record = getattr(obj, "record", None)
        if record:
            return current_values(record).result
        if obj.cancelled_at:
            return "CANCELLED"
        return "UPCOMING" if obj.scheduled_at > timezone.now() else "UNRECORDED"

    def get_reminder_enabled(self, obj) -> bool:
        return (
            obj.item.plan.status == PlanStatus.ACTIVE
            and obj.cancelled_at is None
            and obj.scheduled_at > timezone.now()
        )

    def to_representation(self, instance):
        result = super().to_representation(instance)
        if not self.context.get("include_records", True):
            result.pop("record", None)
        return result
