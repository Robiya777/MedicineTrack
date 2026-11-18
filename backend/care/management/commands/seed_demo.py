import os
import secrets
import uuid
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Role, User
from care.models import Discharge, Organization, Patient, PatientAssignment, Territory
from care.scopes import active_assignments
from care.services import confirm_discharge
from medications.models import MedicationPlan
from medications.services import approve_plan, create_plan
from messaging.models import WorkSchedule
from messaging.services import ensure_conversation


def demo_id(name):
    return uuid.uuid5(uuid.NAMESPACE_URL, f"medicinetrack:synthetic:{name}")


class Command(BaseCommand):
    help = "Create repeatable synthetic demo accounts and cases (DEMO_MODE only)."

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEMO_MODE:
            raise CommandError("Seed requires DEMO_MODE=true.")
        password = os.getenv("DEMO_PASSWORD") or secrets.token_urlsafe(18)
        territory, _ = Territory.objects.get_or_create(
            id=demo_id("territory"), defaults={"name": "Demo hudud"}
        )
        hospital, _ = Organization.objects.get_or_create(
            id=demo_id("hospital"),
            defaults={"name": "Demo statsionar", "type": "HOSPITAL", "territory": territory},
        )
        clinic, _ = Organization.objects.get_or_create(
            id=demo_id("clinic"),
            defaults={"name": "Demo poliklinika", "type": "CLINIC", "territory": territory},
        )
        users = {}
        for username, role, org in [
            ("demo.hospital", Role.COORDINATOR, hospital),
            ("demo.doctor", Role.DOCTOR, clinic),
            ("demo.doctor2", Role.DOCTOR, clinic),
            ("demo.coordinator", Role.COORDINATOR, hospital),
            ("demo.admin", Role.ADMIN, None),
        ]:
            user, _ = User.objects.get_or_create(
                username=username, defaults={"role": role, "organization": org}
            )
            user.set_password(password)
            user.can_approve_medication_schedule = role == Role.DOCTOR
            user.save(update_fields=["password", "can_approve_medication_schedule"])
            users[role if username != "demo.doctor2" else "DOCTOR2"] = user
        doctor = users[Role.DOCTOR]
        WorkSchedule.objects.get_or_create(
            doctor=doctor,
            defaults={
                "organization": clinic,
                "shifts": [{"weekday": day, "start": "09:00", "end": "18:00"} for day in range(5)],
            },
        )
        for name, hours, assigned in [
            ("normal", 1, True),
            ("unassigned", 2, False),
            ("overdue", 25, True),
        ]:
            patient, _ = Patient.objects.get_or_create(
                id=demo_id(f"patient:{name}"),
                defaults={
                    "created_by": users[Role.COORDINATOR],
                    "created_by_org": hospital,
                    "full_name": f"Sintetik bemor — {name}",
                    "birth_date": date(1980, 1, 1),
                    "address": "Demo manzil",
                    "territory": territory,
                    "no_phone_reason": "Sintetik demo",
                },
            )
            if assigned:
                PatientAssignment.objects.get_or_create(
                    patient=patient,
                    valid_to=None,
                    defaults={
                        "doctor": doctor,
                        "organization": clinic,
                        "valid_from": timezone.now() - timedelta(days=1),
                    },
                )
            discharge, _ = Discharge.objects.get_or_create(
                id=demo_id(f"discharge:{name}"),
                defaults={
                    "patient": patient,
                    "hospital": hospital,
                    "managing_organization": hospital,
                    "created_by": users[Role.COORDINATOR],
                    "discharged_at": timezone.now() - timedelta(hours=hours),
                    "recommendations": "Demo tavsiya: rejalashtirilgan patronaj.",
                    "follow_up_reason": "Sintetik demo holati",
                },
            )
            confirm_discharge(discharge.pk, users[Role.COORDINATOR])
            if name == "normal":
                account, _ = User.objects.get_or_create(
                    username="demo.patient", defaults={"role": Role.PATIENT, "patient": patient}
                )
                account.set_password(password)
                account.save(update_fields=["password"])
                ensure_conversation(patient.id)
                if (
                    not MedicationPlan.objects.filter(discharge=discharge).exists()
                    and active_assignments().filter(patient=patient, doctor=doctor).exists()
                ):
                    day = timezone.now().astimezone(ZoneInfo("Asia/Tashkent")).date()
                    plan = create_plan(
                        patient.id,
                        users[Role.COORDINATOR],
                        {
                            "discharge_id": discharge.id,
                            "items": [
                                {
                                    "name": "Demo dori A",
                                    "prescribed_dose_text": "Sintetik doza (demo)",
                                    "route": "Sintetik qabul yo‘li",
                                    "source_reference": "Demo epikriz — sintetik ko‘rsatma",
                                    "start_date": day - timedelta(days=1),
                                    "end_date": day + timedelta(days=1),
                                    "timezone": "Asia/Tashkent",
                                    "local_times": ["08:00", "20:00"],
                                }
                            ],
                        },
                    )
                    approve_plan(
                        plan.id,
                        doctor,
                        {"version": plan.version, "lock_version": plan.lock_version},
                    )
        self.stdout.write(
            self.style.SUCCESS(
                "Synthetic accounts: demo.hospital, demo.doctor, demo.doctor2, demo.coordinator, demo.admin, demo.patient"
            )
        )
        if not os.getenv("DEMO_PASSWORD"):
            self.stdout.write(f"Generated demo password (store locally): {password}")
        self.stdout.write(
            "Existing case deadlines were preserved. Re-running rotates demo passwords."
        )
