from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, model_validator


class AvailabilityCreate(BaseModel):
    weekday: int = Field(ge=0, le=6)
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


class AvailabilityRead(AvailabilityCreate):
    id: UUID
    instructor_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
