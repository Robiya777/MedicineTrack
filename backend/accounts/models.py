import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models

from common.models import UUIDModel


class Role(models.TextChoices):
    HOSPITAL = "HOSPITAL", "Statsionar xodimi"
    DOCTOR = "DOCTOR", "Oilaviy shifokor"
    COORDINATOR = "COORDINATOR", "Koordinator"
    ADMIN = "ADMIN", "Texnik admin"
    PATIENT = "PATIENT", "Bemor"


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=16, choices=Role.choices)
    can_approve_medication_schedule = models.BooleanField(default=False)
    organization = models.ForeignKey(
        "care.Organization", null=True, blank=True, on_delete=models.PROTECT
    )
    patient = models.OneToOneField(
        "care.Patient", null=True, blank=True, on_delete=models.PROTECT, related_name="account"
    )


class AuthSession(UUIDModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    current_jti = models.CharField(max_length=64)
    client = models.CharField(max_length=10, choices=[("web", "web"), ("android", "android")])
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True)


class ActivationCode(UUIDModel):
    patient = models.OneToOneField("care.Patient", on_delete=models.CASCADE)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True)
