from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


PLATFORM_FEE_RATE = 0.20


class PaymentRead(BaseModel):
    id: UUID
    lesson_id: UUID
    amount: float
    platform_fee: float
    instructor_amount: float
    status: str
    created_at: datetime
    released_at: datetime | None = None

    class Config:
        from_attributes = True


class PaymentPayResponse(BaseModel):
    lesson_id: UUID
    lesson_status: str
    payment: PaymentRead
    confirmation_code: str | None = None
