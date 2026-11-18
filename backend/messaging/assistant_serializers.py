from decimal import Decimal
from urllib.parse import urlencode

from rest_framework import serializers

from .models import AssistantAssessment, EmergencyEvent, EmergencyIncident
from .triage import DISCLAIMER


class AssistantConfigSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(read_only=True)
    mode = serializers.ChoiceField(choices=["DEMO", "DISABLED"], read_only=True)
    external_model = serializers.BooleanField(read_only=True)
    real_dispatch = serializers.BooleanField(read_only=True)
    country = serializers.CharField(read_only=True)
    emergency_number = serializers.CharField(read_only=True)


class EmergencyEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmergencyEvent
        fields = ["id", "kind", "detail", "created_at"]


class EmergencySerializer(serializers.ModelSerializer):
    patient = serializers.UUIDField(source="episode.conversation.patient_id", read_only=True)
    patient_name = serializers.CharField(
        source="episode.conversation.patient.full_name", read_only=True
    )
    contact = serializers.CharField(source="episode.conversation.patient.contact", read_only=True)
    registered_address = serializers.CharField(
        source="episode.conversation.patient.address", read_only=True
    )
    conversation = serializers.UUIDField(source="episode.conversation_id", read_only=True)
    risk = serializers.CharField(source="assessment.risk", read_only=True)
    reasons = serializers.JSONField(source="assessment.reasons", read_only=True)
    location = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()
    notice = serializers.SerializerMethodField()

    class Meta:
        model = EmergencyIncident
        fields = [
            "id",
            "reference",
            "state",
            "demo",
            "emergency_number",
            "patient",
            "patient_name",
            "contact",
            "registered_address",
            "conversation",
            "risk",
            "reasons",
            "location",
            "events",
            "notice",
            "acknowledged_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_location(self, obj) -> dict | None:
        if not obj.location_consent_at or obj.latitude is None or obj.longitude is None:
            return None
        lat, lon = float(obj.latitude), float(obj.longitude)
        return {
            "latitude": lat,
            "longitude": lon,
            "accuracy_m": obj.accuracy_m,
            "source": obj.location_source,
            "recorded_at": obj.location_recorded_at.isoformat(),
            "shared_at": obj.location_shared_at.isoformat(),
            "consented": True,
            "map_url": "https://www.openstreetmap.org/?"
            + urlencode({"mlat": lat, "mlon": lon})
            + f"#map=17/{lat}/{lon}",
        }

    def get_events(self, obj) -> list[dict]:
        rows = list(obj.events.order_by("-created_at", "-id")[:20])
        return EmergencyEventSerializer(reversed(rows), many=True).data

    def get_notice(self, obj) -> str:
        return "DEMO: haqiqiy tez yordam chaqirilmagan. Haqiqiy vaziyatda 103 ga telefon qiling."


class AssistantAssessmentSerializer(serializers.ModelSerializer):
    emergency = EmergencySerializer(source="incident", read_only=True, allow_null=True)
    disclaimer = serializers.SerializerMethodField()

    class Meta:
        model = AssistantAssessment
        fields = [
            "id",
            "risk",
            "reply",
            "reasons",
            "question",
            "mode",
            "engine_version",
            "reply_at",
            "reply_reason",
            "emergency",
            "disclaimer",
            "created_at",
        ]
        read_only_fields = fields

    def get_disclaimer(self, obj) -> str:
        return DISCLAIMER


class EmergencyLocationInput(serializers.Serializer):
    consent = serializers.BooleanField()
    source = serializers.ChoiceField(choices=["DEVICE", "DEMO"], default="DEVICE")
    latitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal("-90"),
        max_value=Decimal("90"),
        required=False,
    )
    longitude = serializers.DecimalField(
        max_digits=9,
        decimal_places=6,
        min_value=Decimal("-180"),
        max_value=Decimal("180"),
        required=False,
    )
    accuracy_m = serializers.FloatField(
        min_value=0, max_value=100000, required=False, allow_null=True
    )
    recorded_at = serializers.DateTimeField(required=False)

    def validate_consent(self, value):
        if not value:
            raise serializers.ValidationError("Lokatsiyani ulashish uchun aniq rozilik kerak.")
        return value
