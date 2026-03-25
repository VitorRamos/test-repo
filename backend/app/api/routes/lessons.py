from datetime import datetime, timedelta
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, get_current_user
from backend.app.models.instructor import Instructor
from backend.app.models.lesson import Lesson
from backend.app.models.user import User
from backend.app.schemas.lesson import LessonCreate, LessonRead, LessonConfirmCode

router = APIRouter()

def generate_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

@router.post("/book", response_model=LessonRead)
def book_lesson(
    data: LessonCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Apenas alunos podem agendar aulas")

    instructor = db.query(Instructor).filter(
        Instructor.id == data.instructor_id,
        Instructor.active
    ).first()

    if not instructor:
        raise HTTPException(status_code=404, detail="Instrutor não encontrado")

    if data.scheduled_start < datetime.now():
        raise HTTPException(status_code=400, detail="O horário deve ser no futuro")

    scheduled_end = data.scheduled_start + timedelta(hours=data.duration_hours)
    total_price = instructor.price_per_hour * data.duration_hours

    lesson = Lesson(
        student_id=user.id,
        instructor_id=instructor.id,
        scheduled_start=data.scheduled_start,
        scheduled_end=scheduled_end,
        hour_price=instructor.price_per_hour,
        total_price=total_price,
        status="pending_instructor"
    )

    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    return lesson


@router.get("/my-bookings", response_model=list[LessonRead])
def get_my_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Apenas alunos podem ver agendamentos")

    lessons = db.query(Lesson).filter(Lesson.student_id == user.id).all()
    return lessons


@router.post("/{lesson_id}/confirm", response_model=LessonRead)
def confirm_booking(
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "instructor":
        raise HTTPException(status_code=403, detail="Apenas instrutores podem confirmar agendamentos")

    instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instrutor não encontrado")

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson or lesson.instructor_id != instructor.id:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    if lesson.status != "pending_instructor":
        raise HTTPException(status_code=400, detail="Aula não pode ser confirmada")

    lesson.status = "confirmed"
    lesson.confirmation_code = generate_code()
    instructor.total_lessons += 1

    db.add(lesson)
    db.add(instructor)
    db.commit()
    db.refresh(lesson)

    return lesson


@router.post("/{lesson_id}/confirm-code", response_model=LessonRead)
def confirm_lesson_code(
    lesson_id: str,
    data: LessonConfirmCode,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "instructor":
        raise HTTPException(status_code=403, detail="Apenas instrutores podem confirmar o código")

    instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instrutor não encontrado")

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson or lesson.instructor_id != instructor.id:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    if lesson.status != "confirmed":
        raise HTTPException(status_code=400, detail="Aula não pode ser validada")

    if not lesson.confirmation_code or lesson.confirmation_code != data.code:
        raise HTTPException(status_code=400, detail="Código inválido")

    lesson.status = "completed"
    lesson.code_confirmed_at = datetime.now()
    lesson.code_confirmed_by_instructor = True

    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    return lesson


@router.post("/{lesson_id}/cancel", response_model=LessonRead)
def cancel_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    if lesson.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Aula não pode ser cancelada")

    if user.role == "student":
        if lesson.student_id != user.id:
            raise HTTPException(status_code=403, detail="Sem permissão para cancelar esta aula")
    elif user.role == "instructor":
        instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
        if not instructor or lesson.instructor_id != instructor.id:
            raise HTTPException(status_code=403, detail="Sem permissão para cancelar esta aula")
    else:
        raise HTTPException(status_code=403, detail="Sem permissão para cancelar esta aula")

    lesson.status = "cancelled"
    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    return lesson
