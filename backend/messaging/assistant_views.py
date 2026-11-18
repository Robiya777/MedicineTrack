from drf_spectacular.utils import extend_schema
from rest_framework import mixins
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from accounts.models import Role
from care.views import ScopedViewSet

from .assistant import acknowledge, assistant_enabled, incidents_for, share_location
from .assistant_serializers import (
    AssistantConfigSerializer,
    EmergencyLocationInput,
    EmergencySerializer,
)


class AssistantConfigView(APIView):
    @extend_schema(responses=AssistantConfigSerializer)
    def get(self, request):
        enabled = assistant_enabled()
        return Response(
            {
                "enabled": enabled,
                "mode": "DEMO" if enabled else "DISABLED",
                "external_model": False,
                "real_dispatch": False,
                "country": "UZ",
                "emergency_number": "103",
            }
        )


class AssistantActionThrottle(UserRateThrottle):
    scope = "assistant_actions"


class EmergencyViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, ScopedViewSet):
    serializer_class = EmergencySerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return (
            incidents_for(self.request.user)
            .select_related("assessment", "episode__conversation__patient")
            .order_by("-created_at", "-id")
        )

    def get_throttles(self):
        return (
            [AssistantActionThrottle()]
            if self.request.method == "POST"
            else super().get_throttles()
        )

    def check_idempotency_scope(self, request, *args, **kwargs):
        if self.action == "location" and request.user.role != Role.PATIENT:
            raise PermissionDenied("Faqat bemorning roziligi bilan.")
        if self.action == "acknowledge" and request.user.role not in {
            Role.COORDINATOR,
            Role.DOCTOR,
        }:
            raise PermissionDenied("Faqat mas’ul tibbiyot xodimi uchun.")
        super().check_idempotency_scope(request, *args, **kwargs)

    @extend_schema(request=EmergencyLocationInput, responses=EmergencySerializer)
    @action(detail=True, methods=["post"])
    def location(self, request, pk=None):
        self.get_object()
        serializer = EmergencyLocationInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        incident = share_location(pk, request.user, serializer.validated_data, request)
        return Response(self.get_serializer(self.get_queryset().get(pk=incident.pk)).data)

    @extend_schema(request=None, responses=EmergencySerializer)
    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        self.get_object()
        incident = acknowledge(pk, request.user, request)
        return Response(self.get_serializer(self.get_queryset().get(pk=incident.pk)).data)
