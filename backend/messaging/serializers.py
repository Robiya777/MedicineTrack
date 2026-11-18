from datetime import date, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .assistant_serializers import AssistantAssessmentSerializer
from .groups import can_manage_team, team_metadata
from .models import Conversation, Message, PatientStatusUpdate, WorkSchedule
from .services import schedule_snapshot


class ConversationSerializer(serializers.ModelSerializer):
    assistant_enabled = serializers.SerializerMethodField()
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    team = serializers.SerializerMethodField()
    can_manage_team = serializers.SerializerMethodField()
    response_due_at = serializers.SerializerMethodField()
    first_unanswered_at = serializers.SerializerMethodField()
    work_schedule = serializers.SerializerMethodField()
    response_policy = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "patient",
            "doctor",
            "status",
            "response_due_at",
            "first_unanswered_at",
            "work_schedule",
            "response_policy",
            "created_at",
            "patient_name",
            "team",
            "can_manage_team",
            "assistant_enabled",
        ]
        read_only_fields = fields

    @extend_schema_field(
        {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "format": "uuid"},
                    "name": {"type": "string"},
                    "online": {"type": "boolean"},
                    "primary": {"type": "boolean"},
                },
                "required": ["id", "name", "online", "primary"],
            },
        }
    )
    def get_team(self, obj):
        return team_metadata(obj.patient_id)

    def get_can_manage_team(self, obj) -> bool:
        request = self.context.get("request")
        return bool(request and can_manage_team(request.user, obj.patient))

    def get_assistant_enabled(self, obj) -> bool:
        from .assistant import assistant_enabled

        return assistant_enabled()

    def get_response_due_at(self, obj) -> str | None:
        episode = obj.episodes.filter(responded_at__isnull=True).first()
        return episode.response_due_at.isoformat() if episode and episode.response_due_at else None

    def get_first_unanswered_at(self, obj) -> str | None:
        episode = obj.episodes.filter(responded_at__isnull=True).first()
        return episode.first_unanswered_at.isoformat() if episode else None

    def get_work_schedule(self, obj) -> dict:
        return schedule_snapshot(obj.doctor)

    def get_response_policy(self, obj) -> str:
        if not obj.doctor_id:
            return "Mas’ul tayinlanmoqda"
        if not schedule_snapshot(obj.doctor):
            return "Javob vaqti belgilanmagan"
        return "Javob maqsadi: 4 ish soati. Shoshilinch yordam kerak bo‘lsa chat javobini kutmang."


class MessageSerializer(serializers.ModelSerializer):
    assistant = serializers.SerializerMethodField()
    assistant_status = serializers.SerializerMethodField()
    assistant_due_at = serializers.DateTimeField(
        source="assistant_assessment.reply_due_at", read_only=True, allow_null=True
    )
    sender_name = serializers.SerializerMethodField()
    sender_role = serializers.CharField(source="sender.role", read_only=True)
    delivery_status = serializers.SerializerMethodField()
    answered_at = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "conversation",
            "sender",
            "text",
            "sent_at",
            "read_at",
            "kind",
            "delivery_status",
            "answered_at",
            "assistant",
            "assistant_status",
            "assistant_due_at",
            "sender_name",
            "sender_role",
        ]
        read_only_fields = fields

    @extend_schema_field(AssistantAssessmentSerializer(allow_null=True))
    def get_assistant(self, obj):
        assessment = getattr(obj, "assistant_assessment", None)
        return (
            AssistantAssessmentSerializer(assessment).data
            if assessment and assessment.reply_at
            else None
        )

    def get_assistant_status(self, obj) -> str | None:
        assessment = getattr(obj, "assistant_assessment", None)
        if not assessment:
            return None
        if assessment.reply_at:
            return "REPLIED"
        return "CANCELLED" if assessment.suppressed_at else "WAITING"

    def get_sender_name(self, obj) -> str:
        return obj.sender.get_full_name() or obj.sender.username

    def get_delivery_status(self, obj) -> str:
        if obj.response_episode_id and obj.response_episode.responded_at:
            return "ANSWERED"
        return "READ" if obj.read_at else "SENT"

    def get_answered_at(self, obj) -> str | None:
        episode = obj.response_episode
        return episode.responded_at.isoformat() if episode and episode.responded_at else None


class MessageInput(serializers.Serializer):
    text = serializers.CharField(min_length=1, max_length=4000)
    assistant_response_to = serializers.UUIDField(required=False)


class StatusInput(serializers.Serializer):
    self_reported_state = serializers.ChoiceField(
        choices=PatientStatusUpdate._meta.get_field("self_reported_state").choices
    )
    note = serializers.CharField(min_length=1, max_length=4000)
    observed_at = serializers.DateTimeField()

    def validate_observed_at(self, value):
        if value > timezone.now():
            raise serializers.ValidationError("Kuzatuv vaqti kelajakda bo‘lmaydi.")
        return value


class StatusSerializer(serializers.ModelSerializer):
    patient_reported = serializers.BooleanField(default=True, read_only=True)

    class Meta:
        model = PatientStatusUpdate
        fields = [
            "id",
            "conversation",
            "message",
            "self_reported_state",
            "note",
            "observed_at",
            "received_at",
            "patient_reported",
        ]
        read_only_fields = fields


class ScheduleSerializer(serializers.ModelSerializer):
    version = serializers.IntegerField(min_value=0)

    class Meta:
        model = WorkSchedule
        fields = ["id", "doctor", "organization", "timezone", "shifts", "exceptions", "version"]
        read_only_fields = ["id", "doctor", "organization"]

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise serializers.ValidationError("IANA vaqt zonasini kiriting.") from exc
        return value

    def validate(self, attrs):
        shifts = attrs.get("shifts", [])
        exceptions = attrs.get("exceptions", {})
        if not isinstance(shifts, list) or not isinstance(exceptions, dict):
            raise serializers.ValidationError(
                "shifts — ro‘yxat, exceptions — obyekt bo‘lishi kerak."
            )
        groups = {}
        try:
            for shift in shifts:
                weekday = shift["weekday"]
                if type(weekday) is not int or not 0 <= weekday <= 6:
                    raise ValueError()
                groups.setdefault(weekday, []).append(shift)
            for day, intervals in exceptions.items():
                date.fromisoformat(day)
                if not isinstance(intervals, list):
                    raise ValueError()
                groups[day] = intervals
            for intervals in groups.values():
                previous_end = None
                for item in sorted(intervals, key=lambda value: value["start"]):
                    start, end = time.fromisoformat(item["start"]), time.fromisoformat(item["end"])
                    if (
                        start.tzinfo
                        or end.tzinfo
                        or start >= end
                        or (previous_end and start < previous_end)
                    ):
                        raise ValueError()
                    previous_end = end
        except (KeyError, ValueError, TypeError, AttributeError) as exc:
            raise serializers.ValidationError(
                "Jadval noto‘g‘ri yoki smenalar ustma-ust kelgan."
            ) from exc
        return attrs
