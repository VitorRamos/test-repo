from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class NotificationRead(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    message: str
    lesson_id: UUID | None = None
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True
