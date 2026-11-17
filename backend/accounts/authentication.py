from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import AuthSession, Role


class SessionJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not AuthSession.objects.filter(
            id=validated_token.get("sid"),
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        ).exists():
            raise AuthenticationFailed("Sessiya bekor qilingan.")
        if user.role not in Role.values or (
            user.role not in {Role.ADMIN, Role.PATIENT}
            and (not user.organization_id or not user.organization.active)
        ):
            raise AuthenticationFailed("Akkaunt faol muassasaga bog‘lanmagan.")
        return user
