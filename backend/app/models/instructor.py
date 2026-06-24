from uuid import UUID, uuid4
from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from backend.app.db.base import Base


class Instructor(Base):
    __tablename__ = "instructors"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))
    name: Mapped[str]
    cpf: Mapped[str]
    detran_license: Mapped[str]
    price_per_hour: Mapped[float]
    city: Mapped[str]
    state: Mapped[str]
    bio: Mapped[str | None] = mapped_column(nullable=True)
    rating: Mapped[float] = mapped_column(default=0.0)
    total_lessons: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    active: Mapped[bool] = mapped_column(default=True)
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)