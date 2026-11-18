"""Foreground presence belongs to a session, so logging out one tab leaves others online."""

from datetime import timedelta

from django.utils import timezone

from .models import AuthSession, Role

PRESENCE_TTL_SECONDS = 45


def online_doctor_ids(ids, now=None):
    now = now or timezone.now()
    return set(
        AuthSession.objects.filter(
            user_id__in=ids,
            user__role=Role.DOCTOR,
            user__is_active=True,
            user__organization__active=True,
            revoked_at__isnull=True,
            expires_at__gt=now,
            last_seen_at__gte=now - timedelta(seconds=PRESENCE_TTL_SECONDS),
        ).values_list("user_id", flat=True)
    )
