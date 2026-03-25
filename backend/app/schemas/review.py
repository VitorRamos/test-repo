from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class ReviewCreate(BaseModel):
    lesson_id: UUID
    rating: int = Field(ge=1, le=5)
    comment: str | None = None
    is_public: bool = True


class ReviewRead(BaseModel):
    id: UUID
    lesson_id: UUID
    student_id: UUID
    instructor_id: UUID
    rating: int
    comment: str | None
    student_email: str | None = None
    is_public: bool
    created_at: datetime


class ReviewUpdate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None
    is_public: bool = True

    class Config:
        from_attributes = True
