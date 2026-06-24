from pydantic import BaseModel
from datetime import date


class PublicTimeWindow(BaseModel):
    start_time: str
    end_time: str


class PublicAvailabilitySummary(BaseModel):
    instructor_id: str
    weekdays: list[int]
    time_windows: list[PublicTimeWindow]
    date_from: date | None = None
    date_to: date | None = None
    has_upcoming_slots: bool = False
