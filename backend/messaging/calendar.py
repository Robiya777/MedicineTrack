from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo


def response_deadline(start, schedule, hours=4):
    """Count working intervals, preserving nights, breaks and exception dates."""
    zone = ZoneInfo(schedule["timezone"])
    cursor = start.astimezone(zone)
    remaining = timedelta(hours=hours)
    for _ in range(367):
        day = cursor.date()
        intervals = schedule.get("exceptions", {}).get(day.isoformat())
        if intervals is None:
            intervals = [shift for shift in schedule["shifts"] if shift["weekday"] == day.weekday()]
        for shift in sorted(intervals, key=lambda item: item["start"]):
            begin = datetime.fromisoformat(f"{day.isoformat()}T{shift['start']}").replace(
                tzinfo=zone
            )
            end = datetime.fromisoformat(f"{day.isoformat()}T{shift['end']}").replace(tzinfo=zone)
            available_from = max(cursor, begin)
            if available_from >= end:
                continue
            available = end - available_from
            if remaining <= available:
                return (available_from + remaining).astimezone(UTC)
            remaining -= available
        cursor = datetime.combine(day + timedelta(days=1), datetime.min.time(), tzinfo=zone)
    return None
