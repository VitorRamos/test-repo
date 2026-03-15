from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from uuid import uuid4, UUID
from datetime import datetime

from backend.app.db.base import Base


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    student_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))
    instructor_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))

    scheduled_start: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    scheduled_end: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    hour_price: Mapped[float]
    total_price: Mapped[float]

    status: Mapped[str] = mapped_column(default="pending_payment")