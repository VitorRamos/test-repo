from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class LessonCreate(BaseModel):
    instructor_id: UUID
    scheduled_start: datetime
    duration_hours: float = Field(gt=0)


class LessonConfirmCode(BaseModel):
    code: str


class LessonRead(BaseModel):
    id: UUID
    student_id: UUID
    instructor_id: UUID
    scheduled_start: datetime
    scheduled_end: datetime
    hour_price: float
    total_price: float
    status: str
    confirmation_code: str | None
    code_confirmed_at: datetime | None
    code_confirmed_by_instructor: bool
    student_email: str | None = None
    instructor_name: str | None = None
    has_review: bool = False
    review_rating: int | None = None
    review_comment: str | None = None
    review_is_public: bool | None = None
    created_at: datetime

    class Config:
        from_attributes = True
