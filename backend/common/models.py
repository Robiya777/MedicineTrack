import uuid

from django.db import models


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class IdempotencyRecord(models.Model):
    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE)
    path = models.CharField(max_length=300)
    key = models.CharField(max_length=128)
    fingerprint = models.CharField(max_length=64)
    response = models.JSONField(null=True)
    status_code = models.PositiveSmallIntegerField(null=True)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "path", "key"], name="idempotency_user_path_key"
            )
        ]
