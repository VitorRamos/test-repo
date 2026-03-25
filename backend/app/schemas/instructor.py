from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class InstructorCreate(BaseModel):
    name: str
    cpf: str
    detran_license: str
    price_per_hour: float
    city: str
    state: str
    bio: str | None = None


class InstructorRead(InstructorCreate):
    id: UUID
    user_id: UUID
    rating: float
    total_lessons: int
    created_at: datetime
    active: bool

    class Config:
        from_attributes = True