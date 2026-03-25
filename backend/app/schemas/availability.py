from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class AvailabilityCreate(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: str
    end_time: str


class AvailabilityRead(AvailabilityCreate):
    id: UUID
    instructor_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
