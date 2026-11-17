"""Exercise the synthetic demo over HTTP; credentials/tokens are never printed."""

import json
import os
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
base = os.getenv("SMOKE_BASE_URL", f"http://127.0.0.1:{os.getenv('APP_PORT', '8000')}")
password = os.getenv("DEMO_PASSWORD")
if not password:
    raise SystemExit("Set DEMO_PASSWORD in .env and run seed_demo using the same value.")


def request(path, data=None, token=None, method=None):
    headers = {"Content-Type": "application/json", "Idempotency-Key": str(uuid.uuid4())}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = json.dumps(data).encode() if data is not None else None
    try:
        with urlopen(
            Request(f"{base}{path}", data=payload, headers=headers, method=method), timeout=10
        ) as response:
            return json.load(response)
    except HTTPError as exc:
        error = json.loads(exc.read())
        raise RuntimeError(f"{path}: HTTP {exc.code}, {error.get('code', 'ERROR')}") from None


def login(username):
    result = request(
        "/api/v1/auth/login", {"username": username, "password": password, "client": "android"}
    )
    return result["access"], result["user"]


assert request("/health/ready")["status"] == "ready"
staff, _ = login("demo.hospital")
doctor, doctor_user = login("demo.doctor")
coordinator, _ = login("demo.coordinator")
patient_token, _ = login("demo.patient")
territory = request("/api/v1/reference/territories", token=staff)["results"][0]["id"]
patient = request(
    "/api/v1/patients",
    {
        "full_name": "Synthetic HTTP smoke case",
        "birth_date": "1980-01-01",
        "address": "Synthetic demo address",
        "territory": territory,
        "no_phone_reason": "Synthetic demo",
    },
    staff,
)
discharge = request(
    "/api/v1/discharges",
    {
        "patient": patient["id"],
        "discharged_at": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
        "recommendations": "Synthetic follow-up",
        "follow_up_reason": "Synthetic smoke case",
    },
    staff,
)
extraction = request(
    f"/api/v1/discharges/{discharge['id']}/ai-extractions",
    {"text": "Tashxis: Sintetik tashxis\nTavsiya: Sintetik tavsiya"},
    staff,
)
for _ in range(30):
    result = request(f"/api/v1/ai-extractions/{extraction['id']}", token=staff)
    if result["status"] not in {"QUEUED", "PROCESSING"}:
        break
    time.sleep(1)
assert result["status"] == "PENDING_REVIEW" and result["is_mock"] is True
request(
    f"/api/v1/ai-extractions/{extraction['id']}/review",
    {
        "summary": None,
        "diagnosis_text": "Sintetik tashxis",
        "recommendations": ["Xodim tasdiqlagan sintetik tavsiya"],
        "follow_up_text": None,
    },
    staff,
)
task = request(f"/api/v1/discharges/{discharge['id']}/confirm", {}, staff)
assert task["status"] == "UNASSIGNED"
task = request(
    f"/api/v1/tasks/{task['id']}/reassign",
    {
        "version": task["version"],
        "doctor_id": doctor_user["id"],
        "reason": "Synthetic smoke assignment",
    },
    coordinator,
)
task = request(f"/api/v1/tasks/{task['id']}/accept", {"version": task["version"]}, doctor)
task = request(
    f"/api/v1/tasks/{task['id']}/complete",
    {
        "version": task["version"],
        "performed_at": datetime.now(UTC).isoformat(),
        "channel": "PHONE",
        "observation": "Synthetic observation",
        "actions": "Synthetic action",
        "follow_up": "Synthetic follow-up",
    },
    doctor,
)
assert task["status"] == "COMPLETED"
conversation = next(
    item
    for item in request("/api/v1/conversations", token=patient_token)["results"]
    if item["status"] == "OPEN"
)
chat = f"/api/v1/conversations/{conversation['id']}"
request(f"{chat}/messages", {"text": "Synthetic patient message"}, patient_token)
request(
    f"{chat}/status-updates",
    {
        "self_reported_state": "UNCHANGED",
        "note": "Synthetic patient status",
        "observed_at": datetime.now(UTC).isoformat(),
    },
    patient_token,
)
request(f"{chat}/read", {}, doctor)
request(f"{chat}/messages", {"text": "Synthetic doctor reply"}, doctor)
messages = request(f"{chat}/messages", token=patient_token)["results"]
assert any(item["delivery_status"] == "ANSWERED" for item in messages)
metrics = request("/api/v1/dashboard/metrics", token=coordinator)
assert metrics["completed_on_time"] >= 1
print(
    "HTTP smoke passed: login, patient, AI mock/review, confirm, reassign, accept, complete, chat, status, reply and metrics."
)
