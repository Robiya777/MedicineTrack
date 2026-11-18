import json
import os
import uuid
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from accounts.models import Role, User
from care.models import Discharge, Organization, Patient, PatientAssignment, Territory
from care.services import confirm_discharge
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from medications.services import approve_plan, create_plan
from messaging.models import WorkSchedule
from messaging.services import ensure_conversation

if not settings.DEMO_MODE or not os.getenv("DEMO_PASSWORD"):
    raise RuntimeError(
        "Synthetic browser fixtures require DEMO_MODE=true and DEMO_PASSWORD."
    )


with transaction.atomic():
    run_id = uuid.uuid4().hex[:8]
    prefix = f"qa.20261118.{run_id}"
    password = os.environ["DEMO_PASSWORD"]
    territory = Territory.objects.create(name=f"Sintetik QA hudud {run_id}")
    hospital = Organization.objects.create(
        name=f"Sintetik QA statsionar {run_id}", type="HOSPITAL", territory=territory
    )
    clinic = Organization.objects.create(
        name=f"Sintetik QA poliklinika {run_id}", type="CLINIC", territory=territory
    )
    actors = {}
    for name, role, org in [
        ("hospital", Role.COORDINATOR, hospital),
        ("doctor", Role.DOCTOR, clinic),
        ("doctor2", Role.DOCTOR, clinic),
        ("coordinator", Role.COORDINATOR, hospital),
        ("admin", Role.ADMIN, None),
        ("clinician", Role.DOCTOR, hospital),
    ]:
        actors[name] = User.objects.create_user(
            username=f"{prefix}.{name}",
            password=password,
            role=role,
            organization=org,
            can_approve_medication_schedule=role == Role.DOCTOR,
        )
    patient = Patient.objects.create(
        created_by=actors["hospital"],
        created_by_org=hospital,
        full_name=f"Sintetik QA bemor {run_id}",
        birth_date=date(1980, 1, 1),
        address="Sintetik QA manzil",
        territory=territory,
        contact="+998900000001",
    )
    actors["patient"] = User.objects.create_user(
        username=f"{prefix}.patient",
        password=password,
        role=Role.PATIENT,
        patient=patient,
    )
    PatientAssignment.objects.create(
        patient=patient,
        doctor=actors["doctor"],
        organization=clinic,
        valid_from=timezone.now() - timedelta(days=2),
    )
    discharge = Discharge.objects.create(
        patient=patient,
        hospital=hospital,
        managing_organization=hospital,
        created_by=actors["hospital"],
        discharged_at=timezone.now() - timedelta(hours=2),
        recommendations="Sintetik QA tavsiya",
        follow_up_reason="Sintetik QA kuzatuv",
    )
    task, _ = confirm_discharge(discharge.id, actors["hospital"])
    for doctor in (actors["doctor"], actors["doctor2"]):
        WorkSchedule.objects.create(
            doctor=doctor,
            organization=clinic,
            shifts=[
                {"weekday": day, "start": "09:00", "end": "18:00"} for day in range(7)
            ],
        )
    conversation = ensure_conversation(patient.id)
    day = timezone.now().astimezone(ZoneInfo("Asia/Tashkent")).date()
    medication = {
        "name": f"Sintetik QA dori {run_id}",
        "prescribed_dose_text": "Sintetik doza (QA)",
        "route": "Sintetik yo‘l",
        "source_reference": "Sintetik QA epikriz, 1-bet",
        "start_date": day - timedelta(days=1),
        "end_date": day + timedelta(days=1),
        "timezone": "Asia/Tashkent",
        "local_times": ["08:00", "20:00"],
    }
    active_plan = create_plan(
        patient.id,
        actors["hospital"],
        {"discharge_id": discharge.id, "items": [medication]},
    )
    approve_plan(
        active_plan.id,
        actors["doctor"],
        {"version": active_plan.version, "lock_version": active_plan.lock_version},
    )
    null_plan = create_plan(
        patient.id,
        actors["hospital"],
        {
            "discharge_id": discharge.id,
            "items": [
                {
                    "name": None,
                    "prescribed_dose_text": None,
                    "route": None,
                    "needs_clarification": True,
                    "local_times": [],
                }
            ],
        },
    )
    complete_plan = create_plan(
        patient.id,
        actors["hospital"],
        {
            "discharge_id": discharge.id,
            "items": [{**medication, "name": f"Sintetik QA tasdiq {run_id}"}],
        },
    )
    clinical_discharge = Discharge.objects.create(
        patient=patient,
        hospital=hospital,
        managing_organization=hospital,
        created_by=actors["clinician"],
        discharged_at=timezone.now() - timedelta(hours=1),
        recommendations="Sintetik klinik tavsiya",
        follow_up_reason="Sintetik klinik kuzatuv",
    )
    clinical_plan = create_plan(
        patient.id,
        actors["hospital"],
        {
            "discharge_id": clinical_discharge.id,
            "items": [{**medication, "name": f"Sintetik QA klinik dori {run_id}"}],
        },
    )
    cases = {}
    for label, hours, assigned in [("unassigned", 1, False), ("overdue", 25, True)]:
        p = Patient.objects.create(
            created_by=actors["hospital"],
            created_by_org=hospital,
            full_name=f"Sintetik QA {label} {run_id}",
            birth_date=date(1980, 1, 1),
            address="Sintetik QA manzil",
            territory=territory,
            no_phone_reason="Sintetik QA",
        )
        if assigned:
            PatientAssignment.objects.create(
                patient=p,
                doctor=actors["doctor"],
                organization=clinic,
                valid_from=timezone.now() - timedelta(days=2),
            )
        d = Discharge.objects.create(
            patient=p,
            hospital=hospital,
            managing_organization=hospital,
            created_by=actors["hospital"],
            discharged_at=timezone.now() - timedelta(hours=hours),
            recommendations="Sintetik QA tavsiya",
            follow_up_reason="Sintetik QA kuzatuv",
        )
        t, _ = confirm_discharge(d.id, actors["hospital"])
        cases[label] = {
            "patient_id": str(p.id),
            "discharge_id": str(d.id),
            "task_id": str(t.id),
        }
    print(
        json.dumps(
            {
                "run_id": run_id,
                "users": {
                    name: {"username": u.username, "id": str(u.id)}
                    for name, u in actors.items()
                },
                "patient_id": str(patient.id),
                "patient_name": patient.full_name,
                "territory_id": str(territory.id),
                "hospital_id": str(hospital.id),
                "clinic_id": str(clinic.id),
                "discharge_id": str(discharge.id),
                "task_id": str(task.id),
                "conversation_id": str(conversation.id),
                "active_plan_id": str(active_plan.id),
                "null_plan_id": str(null_plan.id),
                "complete_plan_id": str(complete_plan.id),
                "clinical_discharge_id": str(clinical_discharge.id),
                "clinical_plan_id": str(clinical_plan.id),
                "cases": cases,
            },
            ensure_ascii=False,
        )
    )
