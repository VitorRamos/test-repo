"""Unit tests for availability matching and time helpers."""

from datetime import date
from uuid import uuid4

from backend.app.api.availability_utils import (
    availability_matches_date,
    get_availability_weekdays,
    parse_time_value,
)
from backend.app.models.availability import Availability


def _slot(**kwargs) -> Availability:
    defaults = {
        "id": uuid4(),
        "instructor_id": uuid4(),
        "weekday": 1,
        "start_date": date(2026, 6, 22),
        "end_date": date(2026, 6, 28),
        "days_of_week": "1,3,5",
        "start_time": "08:00",
        "end_time": "12:00",
    }
    defaults.update(kwargs)
    return Availability(**defaults)


def test_parse_time_value():
    assert parse_time_value("09:30").hour == 9
    assert parse_time_value("09:30").minute == 30


def test_get_availability_weekdays_from_days_of_week():
    slot = _slot(days_of_week="0,2,6")
    assert get_availability_weekdays(slot) == [0, 2, 6]


def test_get_availability_weekdays_falls_back_to_weekday_column():
    slot = _slot(days_of_week=None, weekday=4)
    assert get_availability_weekdays(slot) == [4]


def test_availability_matches_date_inside_range_and_weekday():
    # 2026-06-22 is Monday -> JS weekday 1
    slot = _slot(
        start_date=date(2026, 6, 22),
        end_date=date(2026, 6, 28),
        days_of_week="1",
    )
    assert availability_matches_date(slot, date(2026, 6, 22)) is True


def test_availability_rejects_date_outside_range():
    slot = _slot(start_date=date(2026, 6, 22), end_date=date(2026, 6, 24), days_of_week="1,2,3,4,5,6,0")
    assert availability_matches_date(slot, date(2026, 6, 21)) is False
    assert availability_matches_date(slot, date(2026, 6, 25)) is False


def test_availability_rejects_wrong_weekday():
    # Tuesday 2026-06-23 -> JS weekday 2; slot only Monday
    slot = _slot(days_of_week="1")
    assert availability_matches_date(slot, date(2026, 6, 23)) is False
