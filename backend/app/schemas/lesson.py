from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class LessonCreate(BaseModel):
    instructor_id: UUID
    scheduled_start: datetime
    duration_hours: float = Field(gt=0)


class LessonRead(BaseModel):
    id: UUID
    student_id: UUID
    instructor_id: UUID
    scheduled_start: datetime
    scheduled_end: datetime
    hour_price: float
    total_price: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
