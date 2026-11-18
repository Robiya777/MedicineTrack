from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    organization_type = serializers.CharField(
        source="organization.type", read_only=True, allow_null=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "role",
            "organization",
            "organization_type",
            "patient",
            "can_approve_medication_schedule",
        ]
        read_only_fields = fields


class TabSessionInput(serializers.Serializer):
    tab_id = serializers.UUIDField(required=False)


class LoginInput(TabSessionInput):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    client = serializers.ChoiceField(choices=["web", "android"], default="android")


class RefreshInput(TabSessionInput):
    refresh = serializers.CharField(required=False)


class TokenOutput(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField(required=False)
    user = UserSerializer()


class ActivationInput(serializers.Serializer):
    patient_id = serializers.UUIDField()
    code = serializers.CharField(max_length=128)
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class ActivationIssueInput(serializers.Serializer):
    phone_verified = serializers.BooleanField()


class ActivationOutput(serializers.Serializer):
    patient_id = serializers.UUIDField()
    code = serializers.CharField()
    expires_at = serializers.DateTimeField()
