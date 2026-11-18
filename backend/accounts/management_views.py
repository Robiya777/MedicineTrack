from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import mixins, serializers
from rest_framework.permissions import BasePermission

from care.services import audit
from care.views import ScopedViewSet

from .models import Role, User


class IsTechnicalAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == Role.ADMIN


class StaffAccountSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=[Role.ADMIN, Role.DOCTOR, Role.COORDINATOR])
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "role",
            "organization",
            "is_active",
            "can_approve_medication_schedule",
            "password",
        ]
        read_only_fields = ["id"]

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def validate(self, attrs):
        role = attrs.get("role", getattr(self.instance, "role", None))
        organization = attrs.get("organization", getattr(self.instance, "organization", None))
        if not self.instance and "password" not in attrs:
            raise serializers.ValidationError({"password": "Parol majburiy."})
        if role != Role.ADMIN and (not organization or not organization.active):
            raise serializers.ValidationError({"organization": "Faol muassasa kerak."})
        if (
            attrs.get(
                "can_approve_medication_schedule",
                getattr(self.instance, "can_approve_medication_schedule", False),
            )
            and role != Role.DOCTOR
        ):
            raise serializers.ValidationError(
                {"can_approve_medication_schedule": "Klinik tasdiq ruxsati faqat DOCTOR uchun."}
            )
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        instance = super().update(instance, validated_data)
        if password:
            instance.set_password(password)
            instance.save(update_fields=["password"])
            instance.authsession_set.filter(revoked_at__isnull=True).update(
                revoked_at=timezone.now()
            )
        return instance


class StaffAccountViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    ScopedViewSet,
):
    serializer_class = StaffAccountSerializer
    permission_classes = [IsTechnicalAdmin]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return User.objects.exclude(role=Role.PATIENT).order_by("username")

    def perform_create(self, serializer):
        obj = serializer.save()
        audit(self.request.user, obj, "ACCOUNT_CREATED", request=self.request)

    def perform_update(self, serializer):
        obj = serializer.save()
        audit(
            self.request.user,
            obj,
            "ACCOUNT_UPDATED",
            [key for key in serializer.validated_data if key != "password"],
            self.request,
        )
