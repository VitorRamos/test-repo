from uuid import UUID, uuid4
from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from backend.app.db.base import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    lesson_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), unique=True)
    student_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))
    instructor_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))
    rating: Mapped[int]
    comment: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
