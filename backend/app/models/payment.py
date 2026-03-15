from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from uuid import uuid4, UUID
from datetime import datetime

from backend.app.db.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )

    lesson_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))

    amount: Mapped[float]
    platform_fee: Mapped[float]
    instructor_amount: Mapped[float]

    status: Mapped[str] = mapped_column(default="pending")

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)