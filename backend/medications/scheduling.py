import uuid
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from rest_framework.exceptions import ValidationError

from .models import DoseOccurrence


def local_instant(day, clock, zone):
    naive = datetime.combine(day, clock)
    first = naive.replace(tzinfo=zone, fold=0)
    second = naive.replace(tzinfo=zone, fold=1)
    try:
        converted = first.astimezone(UTC)
        round_trip = converted.astimezone(zone).replace(tzinfo=None)
    except OverflowError as exc:
        raise ValidationError({"local_times": "Sana UTC chegarasidan tashqarida."}) from exc
    if round_trip != naive:
        raise ValidationError(
            {
                "local_times": f"{day} {clock}: bu mahalliy vaqt mavjud emas; klinik aniqlashtirish kerak."
            }
        )
    if first.utcoffset() != second.utcoffset():
        raise ValidationError(
            {
                "local_times": f"{day} {clock}: vaqt ikki xil talqin qilinadi; klinik aniqlashtirish kerak."
            }
        )
    return converted


def prepare_occurrences(plan, items):
    """Validate the whole bounded course before inserting any occurrence."""
    if not items or len(items) > 20:
        raise ValidationError({"items": "1–20 ta dori yozuvi kerak."})
    rows, ends, seen = [], [], set()
    for item in items:
        required = [
            "name",
            "prescribed_dose_text",
            "route",
            "source_reference",
            "start_date",
            "end_date",
            "timezone",
            "local_times",
        ]
        missing = [field for field in required if not getattr(item, field)]
        if item.needs_clarification or missing:
            raise ValidationError(
                {
                    "items": {
                        str(item.id): {
                            "missing_fields": missing,
                            "message": "Noaniq ko‘rsatmani shifokor to‘ldirib tasdiqlashi kerak.",
                        }
                    }
                }
            )
        if item.start_date > item.end_date or (item.end_date - item.start_date).days >= 90:
            raise ValidationError(
                {"items": "Kurs sanalari to‘g‘ri va maksimum 90 kun bo‘lishi kerak."}
            )
        if len(item.local_times) > 8 or len(set(item.local_times)) != len(item.local_times):
            raise ValidationError({"local_times": "Har kuni maksimum 8 ta takrorlanmas vaqt."})
        zone = ZoneInfo(item.timezone)
        ends.append(local_instant(item.end_date + timedelta(days=1), time.min, zone))
        for offset in range((item.end_date - item.start_date).days + 1):
            day = item.start_date + timedelta(days=offset)
            for clock in item.local_times:
                instant = local_instant(day, time.fromisoformat(clock), zone)
                prescription = (
                    item.name.strip().casefold(),
                    item.prescribed_dose_text.strip().casefold(),
                    item.route.strip().casefold(),
                    instant,
                )
                if prescription in seen:
                    raise ValidationError(
                        {"items": "Bir xil dori/doza/qabul vaqtlari ustma-ust kelgan."}
                    )
                seen.add(prescription)
                rows.append(
                    DoseOccurrence(
                        id=uuid.uuid5(item.id, f"{plan.version}:{instant.isoformat()}"),
                        item=item,
                        plan_version=plan.version,
                        scheduled_at=instant,
                    )
                )
    if (max(item.end_date for item in items) - min(item.start_date for item in items)).days >= 90:
        raise ValidationError({"items": "Butun jadval maksimum 90 kunni qamrashi mumkin."})
    return rows, max(ends)
