from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, get_current_user
from backend.app.api.routes.lessons import generate_code
from backend.app.models.instructor import Instructor
from backend.app.models.lesson import Lesson
from backend.app.models.payment import Payment
from backend.app.models.user import User
from backend.app.schemas.payment import PLATFORM_FEE_RATE, PaymentPayResponse, PaymentRead

router = APIRouter()


def payment_to_read(payment: Payment) -> PaymentRead:
    return PaymentRead(
        id=payment.id,
        lesson_id=payment.lesson_id,
        amount=payment.amount,
        platform_fee=payment.platform_fee,
        instructor_amount=payment.instructor_amount,
        status=payment.status,
        created_at=payment.created_at,
        released_at=payment.released_at,
    )


def create_pending_payment(db: Session, lesson: Lesson) -> Payment:
    existing = db.query(Payment).filter(Payment.lesson_id == lesson.id).first()
    if existing:
        return existing

    platform_fee = round(lesson.total_price * PLATFORM_FEE_RATE, 2)
    instructor_amount = round(lesson.total_price - platform_fee, 2)
    payment = Payment(
        lesson_id=lesson.id,
        student_id=lesson.student_id,
        instructor_id=lesson.instructor_id,
        amount=lesson.total_price,
        platform_fee=platform_fee,
        instructor_amount=instructor_amount,
        status="pending",
    )
    db.add(payment)
    db.flush()
    return payment


def release_payment_for_lesson(db: Session, lesson: Lesson) -> Payment | None:
    payment = db.query(Payment).filter(Payment.lesson_id == lesson.id).first()
    if not payment:
        return None
    if payment.status == "escrow":
        payment.status = "released"
        payment.released_at = datetime.utcnow()
        db.add(payment)
    return payment


@router.post("/lessons/{lesson_id}/pay", response_model=PaymentPayResponse)
def pay_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Student pays for a lesson accepted by the instructor (escrow hold)."""
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Apenas alunos podem pagar aulas")

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson or lesson.student_id != user.id:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    if lesson.status != "pending_payment":
        raise HTTPException(status_code=400, detail="Aula não está aguardando pagamento")

    payment = create_pending_payment(db, lesson)
    payment.status = "escrow"
    db.add(payment)

    lesson.status = "confirmed"
    instructor = db.query(Instructor).filter(Instructor.id == lesson.instructor_id).first()
    if instructor:
        instructor.total_lessons += 1
        db.add(instructor)
    if not lesson.confirmation_code:
        lesson.confirmation_code = generate_code()
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    db.refresh(payment)

    return PaymentPayResponse(
        lesson_id=lesson.id,
        lesson_status=lesson.status,
        payment=payment_to_read(payment),
        confirmation_code=lesson.confirmation_code,
    )


@router.get("/lessons/{lesson_id}", response_model=PaymentRead | None)
def get_lesson_payment(
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    if user.role == "student" and lesson.student_id != user.id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    if user.role == "instructor":
        instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
        if not instructor or lesson.instructor_id != instructor.id:
            raise HTTPException(status_code=403, detail="Sem permissão")

    payment = db.query(Payment).filter(Payment.lesson_id == lesson.id).first()
    if not payment:
        return None
    return payment_to_read(payment)


@router.get("/me", response_model=list[PaymentRead])
def list_my_payments(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == "student":
        payments = db.query(Payment).filter(Payment.student_id == user.id).all()
    elif user.role == "instructor":
        instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
        if not instructor:
            return []
        payments = db.query(Payment).filter(Payment.instructor_id == instructor.id).all()
    else:
        return []
    return [payment_to_read(p) for p in payments]
