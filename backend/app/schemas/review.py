from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class ReviewCreate(BaseModel):
    lesson_id: UUID
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class ReviewRead(BaseModel):
    id: UUID
    lesson_id: UUID
    student_id: UUID
    instructor_id: UUID
    rating: int
    comment: str | None
    created_at: datetime

    class Config:
        from_attributes = True
