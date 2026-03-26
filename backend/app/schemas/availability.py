from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator


class AvailabilityTimeRange(BaseModel):
    start_time: str
    end_time: str

    @model_validator(mode="after")
    def validate_time_window(self):
        try:
            start = datetime.strptime(self.start_time, "%H:%M").time()
            end = datetime.strptime(self.end_time, "%H:%M").time()
        except ValueError as exc:
            raise ValueError("Horários devem estar no formato HH:MM") from exc

        if end <= start:
            raise ValueError("Horário final deve ser maior que o horário inicial")

        return self


class AvailabilityCreate(BaseModel):
    start_date: date
    end_date: date
    weekdays: list[int] = Field(min_length=1, max_length=7)
    time_ranges: list[AvailabilityTimeRange] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_date_window(self):
        if self.end_date < self.start_date:
            raise ValueError("Data final deve ser maior ou igual à data inicial")

        return self

    @field_validator("weekdays")
    @classmethod
    def validate_weekdays(cls, value: list[int]):
        normalized = sorted(set(value))
        if any(day < 0 or day > 6 for day in normalized):
            raise ValueError("Os dias da semana devem estar entre 0 e 6")
        return normalized


class AvailabilityRead(BaseModel):
    id: UUID
    instructor_id: UUID
    weekday: int
    start_date: date | None = None
    end_date: date | None = None
    weekdays: list[int]
    start_time: str
    end_time: str
    created_at: datetime

    class Config:
        from_attributes = True
