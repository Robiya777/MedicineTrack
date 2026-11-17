import hashlib
import json
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response

from .exceptions import Conflict
from .models import IdempotencyRecord


class Replay(APIException):
    def __init__(self, record):
        self.record = record


class IdempotencyMixin:
    """Hold the key lock and business changes in the same database transaction."""

    def dispatch(self, request, *args, **kwargs):
        self.idempotency_record = None
        with transaction.atomic():
            response = super().dispatch(request, *args, **kwargs)
            if response.status_code >= 400:
                transaction.set_rollback(True)
            return response

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        key = request.headers.get("Idempotency-Key")
        if request.method not in {"POST", "PUT", "PATCH"} or key is None:
            return
        if not key.strip() or len(key) > 128:
            raise ValidationError({"Idempotency-Key": "1–128 belgi kiriting."})
        payload = {}
        for name, value in request.data.items():
            if name not in request.FILES:
                payload[name] = value
        for name, upload in request.FILES.items():
            digest = hashlib.sha256()
            for chunk in upload.chunks():
                digest.update(chunk)
            upload.seek(0)
            payload[name] = {"sha256": digest.hexdigest(), "content_type": upload.content_type}
        fingerprint = hashlib.sha256(
            json.dumps(payload, sort_keys=True, default=str).encode()
        ).hexdigest()
        record, _ = IdempotencyRecord.objects.get_or_create(
            user=request.user,
            path=f"{request.method}:{request.path}",
            key=key,
            defaults={
                "fingerprint": fingerprint,
                "expires_at": timezone.now() + timedelta(hours=24),
            },
        )
        record = IdempotencyRecord.objects.select_for_update().get(pk=record.pk)
        if record.expires_at <= timezone.now():
            record.fingerprint = fingerprint
            record.response = record.status_code = None
            record.expires_at = timezone.now() + timedelta(hours=24)
            record.save()
        elif record.fingerprint != fingerprint:
            raise Conflict("Shu Idempotency-Key boshqa ma’lumot bilan ishlatilgan.")
        elif record.status_code:
            raise Replay(record)
        self.idempotency_record = record

    def handle_exception(self, exc):
        if isinstance(exc, Replay):
            response = Response(exc.record.response, status=exc.record.status_code)
            response["Idempotency-Replayed"] = "true"
            return response
        return super().handle_exception(exc)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if self.idempotency_record and response.status_code < 400:
            self.idempotency_record.response = json.loads(JSONRenderer().render(response.data))
            self.idempotency_record.status_code = response.status_code
            self.idempotency_record.save(update_fields=["response", "status_code"])
        return response
