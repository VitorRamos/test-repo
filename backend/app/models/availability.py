from uuid import UUID, uuid4
from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from backend.app.db.base import Base


class Availability(Base):
    __tablename__ = "availability"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    instructor_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True))
    weekday: Mapped[int]
    start_time: Mapped[str]
    end_time: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
