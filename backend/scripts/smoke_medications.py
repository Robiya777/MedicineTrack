"""Exercise TZ 1.2 medication workflows against the running synthetic demo."""

import json
import os
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
base = os.getenv("SMOKE_BASE_URL", f"http://127.0.0.1:{os.getenv('APP_PORT', '8000')}")
password = os.getenv("DEMO_PASSWORD")
if not password:
    raise SystemExit("Set DEMO_PASSWORD and seed_demo before running the HTTP medication smoke.")


def request(path, data=None, token=None, *, key=None, expected=200):
    headers = {"Content-Type": "application/json", "Idempotency-Key": key or str(uuid.uuid4())}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = json.dumps(data).encode() if data is not None else None
    try:
        with urlopen(
            Request(f"{base}{path}", data=payload, headers=headers), timeout=15
        ) as response:
            status, result = response.status, json.load(response)
    except HTTPError as exc:
        status, result = exc.code, json.loads(exc.read())
    if status != expected:
        raise RuntimeError(
            f"{path}: expected HTTP {expected}, got {status}, code={result.get('code', 'ERROR')}"
        )
    return result


def login(username):
    result = request(
        "/api/v1/auth/login", {"username": username, "password": password, "client": "android"}
    )
    return result["access"], result["user"]


def versions(plan):
    return {"version": plan["version"], "lock_version": plan["lock_version"]}


doctor, doctor_user = login("demo.doctor")
staff, _ = login("demo.hospital")
patient, patient_user = login("demo.patient")
coordinator, _ = login("demo.coordinator")
assert doctor_user["can_approve_medication_schedule"]
patient_id = patient_user["patient"]
plans_path = f"/api/v1/patients/{patient_id}/medication-plans"
seeded = request(plans_path, token=patient)["results"]
assert seeded, "Run updated seed_demo first."
day = datetime.now(UTC).astimezone(ZoneInfo("Asia/Tashkent")).date()
plan = request(
    plans_path,
    {
        "discharge_id": seeded[0]["discharge"],
        "items": [
            {
                "name": "Sintetik HTTP demo dori",
                "prescribed_dose_text": "Sintetik doza (demo)",
                "route": "Sintetik qabul yo‘li",
                "source_reference": "Sintetik smoke epikriz",
                "start_date": (day - timedelta(days=1)).isoformat(),
                "end_date": (day + timedelta(days=1)).isoformat(),
                "timezone": "Asia/Tashkent",
                "local_times": ["08:00", "20:00"],
            }
        ],
    },
    staff,
    expected=201,
)
path = f"/api/v1/medication-plans/{plan['id']}"
request(f"{path}/approve", versions(plan), staff, expected=403)
request(f"{path}/occurrences", token=patient, expected=404)
plan = request(f"{path}/approve", versions(plan), doctor)
rows = request(f"{path}/occurrences?page_size=100&plan_version=1", token=patient)["results"]
past = [
    row
    for row in rows
    if datetime.fromisoformat(row["scheduled_at"].replace("Z", "+00:00")) < datetime.now(UTC)
]
assert len(past) >= 2
event_time = datetime.now(UTC).isoformat()
record_data = {
    "plan_version": 1,
    "result": "TAKEN",
    "reported_taken_at": event_time,
    "client_recorded_at": event_time,
    "note": "Sintetik bemor qaydi",
}
record_path = f"/api/v1/dose-occurrences/{past[0]['id']}/record"
key = str(uuid.uuid4())
record = request(record_path, record_data, patient, key=key, expected=201)
assert request(record_path, record_data, patient, key=key, expected=201)["id"] == record["id"]
correction = {
    "plan_version": 1,
    "version": record["version"],
    "result": "SKIPPED",
    "reported_taken_at": None,
    "client_recorded_at": datetime.now(UTC).isoformat(),
    "reason": "Sintetik tuzatish",
}
record = request(f"/api/v1/dose-records/{record['id']}/corrections", correction, patient)
assert record["result"] == "SKIPPED" and record["original"]["result"] == "TAKEN"
queued_at = datetime.now(UTC).isoformat()
queued_data = {
    "plan_version": 1,
    "result": "TAKEN",
    "reported_taken_at": queued_at,
    "client_recorded_at": queued_at,
    "note": "Sintetik offline navbat",
}
revision = request(f"{path}/revisions", versions(plan), doctor, expected=201)
revision_path = f"/api/v1/medication-plans/{revision['id']}"
revision = request(f"{revision_path}/approve", versions(revision), doctor)
assert request(path, token=patient)["status"] == "STOPPED"
late = request(
    f"/api/v1/dose-occurrences/{past[1]['id']}/record", queued_data, patient, expected=201
)
assert late["recorded_against_inactive_plan"] and late["patient_reported"]
future = request(f"{revision_path}/occurrences?page_size=100", token=patient)["results"]
assert future and all(row["plan_version"] == 2 for row in future)
request(
    f"/api/v1/dose-occurrences/{future[0]['id']}/record",
    {**queued_data, "plan_version": 2},
    patient,
    expected=400,
)
revision = request(
    f"{revision_path}/stop", {**versions(revision), "reason": "Sintetik smoke tugadi"}, doctor
)
assert revision["status"] == "STOPPED"
cancelled = request(f"{revision_path}/occurrences", token=patient)["results"]
assert all(not row["reminder_enabled"] and row["cancelled_at"] for row in cancelled)
history = request(f"/api/v1/patients/{patient_id}/medication-history?page_size=100", token=doctor)
assert any(row["id"] == past[0]["id"] and row["status"] == "SKIPPED" for row in history["results"])
request(plans_path, token=coordinator, expected=404)
print(
    "Medication HTTP smoke passed: clinical approval, occurrences, idempotent record, correction, revision, offline history, stop, future-dose and privacy guards."
)
