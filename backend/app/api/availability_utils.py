from __future__ import annotations

from datetime import date, datetime, time, timedelta

from backend.app.models.availability import Availability
from backend.app.models.lesson import Lesson


def parse_time_value(value: str) -> time:
    return datetime.strptime(value, "%H:%M").time()


def get_availability_weekdays(slot: Availability) -> list[int]:
    if slot.days_of_week:
        return [int(day) for day in slot.days_of_week.split(",") if day != ""]
    return [int(slot.weekday)]


def availability_matches_date(slot: Availability, target_date: date) -> bool:
    if slot.start_date and target_date < slot.start_date:
        return False
    if slot.end_date and target_date > slot.end_date:
        return False

    weekday = (target_date.weekday() + 1) % 7
    return weekday in get_availability_weekdays(slot)


def iter_candidate_slots(
    availability: list[Availability],
    booked_lessons: list[Lesson],
    duration_hours: float,
    date_from: date,
    date_to: date,
    now: datetime | None = None
) -> list[dict[str, object]]:
    current_time = now or datetime.now()
    duration_delta = timedelta(hours=duration_hours)
    grouped_slots: list[dict[str, object]] = []

    current_date = date_from
    while current_date <= date_to:
        day_slots = [slot for slot in availability if availability_matches_date(slot, current_date)]
        day_candidates: list[str] = []

        for slot in day_slots:
            start = datetime.combine(current_date, parse_time_value(slot.start_time))
            end = datetime.combine(current_date, parse_time_value(slot.end_time))
            cursor = start

            while cursor + duration_delta <= end:
                candidate_start = cursor
                candidate_end = cursor + duration_delta
                overlaps = any(
                    candidate_start < lesson.scheduled_end and candidate_end > lesson.scheduled_start
                    for lesson in booked_lessons
                )

                if not overlaps and candidate_start > current_time:
                    day_candidates.append(candidate_start.strftime("%Y-%m-%dT%H:%M"))

                cursor += timedelta(minutes=30)

        unique_slots = sorted(set(day_candidates))
        if unique_slots:
            grouped_slots.append({
                "date": current_date.isoformat(),
                "slots": unique_slots
            })

        current_date += timedelta(days=1)

    return grouped_slots
