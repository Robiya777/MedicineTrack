from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuthSession, Role
from .presence import PRESENCE_TTL_SECONDS


class PresenceInput(serializers.Serializer):
    active = serializers.BooleanField()


class PresenceOutput(serializers.Serializer):
    online = serializers.BooleanField(read_only=True)
    expires_in = serializers.IntegerField(read_only=True)


class PresenceView(APIView):
    @extend_schema(request=PresenceInput, responses=PresenceOutput)
    def post(self, request):
        if request.user.role != Role.DOCTOR or not request.auth:
            raise PermissionDenied("Faqat shifokorning joriy sessiyasi uchun.")
        data = PresenceInput(data=request.data)
        data.is_valid(raise_exception=True)
        session = get_object_or_404(
            AuthSession, pk=request.auth.get("sid"), user=request.user, revoked_at__isnull=True
        )
        session.last_seen_at = timezone.now() if data.validated_data["active"] else None
        session.save(update_fields=["last_seen_at"])
        return Response(
            {"online": session.last_seen_at is not None, "expires_in": PRESENCE_TTL_SECONDS}
        )
