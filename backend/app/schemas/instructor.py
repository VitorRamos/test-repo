from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

from backend.app.schemas.user import UserCreate


class InstructorCreate(UserCreate):
    name: str
    cpf: str
    detran_license: str
    price_per_hour: float
    city: str
    state: str
    bio: str | None = None


class InstructorRead(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    cpf: str
    detran_license: str
    price_per_hour: float
    city: str
    state: str
    rating: float
    total_lessons: int
    created_at: datetime
    active: bool

    class Config:
        from_attributes = True