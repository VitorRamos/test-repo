from datetime import datetime, timedelta
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.availability_utils import availability_matches_date, parse_time_value
from backend.app.api.deps import get_db, get_current_user
from backend.app.models.instructor import Instructor
from backend.app.models.lesson import Lesson
from backend.app.models.payment import Payment
from backend.app.models.student import Student
from backend.app.models.user import User
from backend.app.models.review import Review
from backend.app.models.availability import Availability
from backend.app.schemas.lesson import LessonBatchCreate, LessonCreate, LessonRead, LessonConfirmCode
from backend.app.schemas.payment import PLATFORM_FEE_RATE
from backend.app.services.notifications import create_notification

router = APIRouter()

CODE_CONFIRM_GRACE = timedelta(minutes=30)

def is_within_code_confirm_window(scheduled_start, scheduled_end, now=None, grace=None) -> bool:
    """Return True if now is inside [start-grace, end+grace] for code confirmation."""
    now = now if now is not None else datetime.now()
    grace = grace if grace is not None else CODE_CONFIRM_GRACE
    return (scheduled_start - grace) <= now <= (scheduled_end + grace)



def generate_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def resolve_student_name(
    student_user: User | None,
    student_profile: Student | None = None
) -> str | None:
    if student_profile and student_profile.name:
        return student_profile.name
    if student_user and student_user.email:
        local_part = student_user.email.split("@", 1)[0].strip()
        return local_part or None
    return None


def resolve_student_nickname(
    student_user: User | None,
    student_profile: Student | None = None
) -> str | None:
    """Public-facing student label (nickname preferred over legal name/email)."""
    if student_profile and student_profile.nickname:
        return student_profile.nickname
    return resolve_student_name(student_user, student_profile)


def get_student_profile_map(db: Session, user_ids: set) -> dict:
    if not user_ids:
        return {}
    profiles = db.query(Student).filter(Student.user_id.in_(user_ids)).all()
    return {profile.user_id: profile for profile in profiles}




def ensure_pending_payment_record(db: Session, lesson: Lesson) -> Payment:
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


def refund_payment_for_lesson(db: Session, lesson: Lesson) -> None:
    payment = db.query(Payment).filter(Payment.lesson_id == lesson.id).first()
    if not payment:
        return
    if payment.status in ("pending", "escrow"):
        payment.status = "refunded"
        db.add(payment)


def release_payment_for_lesson(db: Session, lesson: Lesson) -> Payment | None:
    payment = db.query(Payment).filter(Payment.lesson_id == lesson.id).first()
    if not payment:
        return None
    if payment.status == "escrow":
        payment.status = "released"
        payment.released_at = datetime.utcnow()
        db.add(payment)
    return payment

def lesson_to_read(
    lesson: Lesson,
    student: User | None,
    instructor: Instructor | None,
    review: Review | None = None,
    student_profile: Student | None = None
) -> LessonRead:
    return LessonRead(
        id=lesson.id,
        student_id=lesson.student_id,
        instructor_id=lesson.instructor_id,
        scheduled_start=lesson.scheduled_start,
        scheduled_end=lesson.scheduled_end,
        hour_price=lesson.hour_price,
        total_price=lesson.total_price,
        status=lesson.status,
        confirmation_code=lesson.confirmation_code,
        code_confirmed_at=lesson.code_confirmed_at,
        code_confirmed_by_instructor=lesson.code_confirmed_by_instructor,
        student_name=resolve_student_name(student, student_profile),
        student_nickname=resolve_student_nickname(student, student_profile),
        student_email=student.email if student else None,
        instructor_name=instructor.name if instructor else None,
        has_review=review is not None,
        review_rating=review.rating if review else None,
        review_comment=review.comment if review else None,
        review_is_public=review.is_public if review else None,
        created_at=lesson.created_at
    )


def validate_lesson_request(
    db: Session,
    student: User,
    instructor: Instructor,
    scheduled_start: datetime,
    duration_hours: float
) -> tuple[datetime, float]:
    if scheduled_start < datetime.now():
        raise HTTPException(status_code=400, detail="O horário deve ser no futuro")

    availability = db.query(Availability).filter(
        Availability.instructor_id == instructor.id
    ).all()
    if not availability:
        raise HTTPException(status_code=400, detail="Instrutor não disponível nesse dia")

    start_time = scheduled_start.time()
    scheduled_end = scheduled_start + timedelta(hours=duration_hours)
    end_time = scheduled_end.time()
    in_window = False
    for slot in availability:
        if not availability_matches_date(slot, scheduled_start.date()):
            continue
        slot_start = parse_time_value(slot.start_time)
        slot_end = parse_time_value(slot.end_time)
        if start_time >= slot_start and end_time <= slot_end:
            in_window = True
            break
    if not in_window:
        raise HTTPException(status_code=400, detail="Horário fora da disponibilidade do instrutor")

    conflicts = db.query(Lesson).filter(
        Lesson.instructor_id == instructor.id,
        Lesson.status.in_(["confirmed", "completed", "pending_payment"]),
        Lesson.scheduled_start < scheduled_end,
        Lesson.scheduled_end > scheduled_start
    ).first()
    if conflicts:
        raise HTTPException(status_code=400, detail="Horário já reservado com outro aluno")

    student_conflicts = db.query(Lesson).filter(
        Lesson.student_id == student.id,
        Lesson.status.in_(["pending_instructor", "confirmed", "completed", "pending_payment"]),
        Lesson.scheduled_start < scheduled_end,
        Lesson.scheduled_end > scheduled_start
    ).first()
    if student_conflicts:
        raise HTTPException(status_code=400, detail="Você já solicitou ou reservou um horário nessa faixa")

    return scheduled_end, instructor.price_per_hour * duration_hours


def create_pending_lesson(
    db: Session,
    student: User,
    instructor: Instructor,
    scheduled_start: datetime,
    duration_hours: float
) -> Lesson:
    scheduled_end, total_price = validate_lesson_request(db, student, instructor, scheduled_start, duration_hours)

    lesson = Lesson(
        student_id=student.id,
        instructor_id=instructor.id,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        hour_price=instructor.price_per_hour,
        total_price=total_price,
        status="pending_instructor"
    )
    db.add(lesson)
    db.flush()
    return lesson

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

    lesson = create_pending_lesson(db, user, instructor, data.scheduled_start, data.duration_hours)
    db.commit()
    db.refresh(lesson)

    return lesson_to_read(lesson, user, instructor)


@router.post("/book-batch", response_model=list[LessonRead])
def book_lessons_batch(
    data: LessonBatchCreate,
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

    starts = sorted(set(data.scheduled_starts))
    lessons: list[Lesson] = []
    local_ranges: list[tuple[datetime, datetime]] = []

    for scheduled_start in starts:
        scheduled_end, _ = validate_lesson_request(db, user, instructor, scheduled_start, data.duration_hours)
        overlaps_selected = any(
            scheduled_start < existing_end and scheduled_end > existing_start
            for existing_start, existing_end in local_ranges
        )
        if overlaps_selected:
            raise HTTPException(status_code=400, detail="Os horários selecionados se sobrepõem")
        local_ranges.append((scheduled_start, scheduled_end))

    for scheduled_start in starts:
        lessons.append(create_pending_lesson(db, user, instructor, scheduled_start, data.duration_hours))

    db.commit()
    for lesson in lessons:
        db.refresh(lesson)

    return [lesson_to_read(lesson, user, instructor) for lesson in lessons]


@router.get("/my-bookings", response_model=list[LessonRead])
def get_my_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Apenas alunos podem ver agendamentos")

    lessons = db.query(Lesson).filter(Lesson.student_id == user.id).all()
    lesson_ids = {lesson.id for lesson in lessons}
    reviews = db.query(Review).filter(Review.lesson_id.in_(lesson_ids)).all() if lesson_ids else []
    review_map = {review.lesson_id: review for review in reviews}
    instructor_ids = {lesson.instructor_id for lesson in lessons}
    instructors = db.query(Instructor).filter(Instructor.id.in_(instructor_ids)).all() if instructor_ids else []
    instructor_map = {inst.id: inst for inst in instructors}

    return [
        lesson_to_read(
            lesson,
            user,
            instructor_map.get(lesson.instructor_id),
            review=review_map.get(lesson.id)
        )
        for lesson in lessons
    ]

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

    conflicts = db.query(Lesson).filter(
        Lesson.instructor_id == instructor.id,
        Lesson.id != lesson.id,
        Lesson.status.in_(["confirmed", "completed", "pending_payment"]),
        Lesson.scheduled_start < lesson.scheduled_end,
        Lesson.scheduled_end > lesson.scheduled_start
    ).first()
    if conflicts:
        raise HTTPException(status_code=400, detail="Horário já reservado com outro aluno")

    pending_conflicts = db.query(Lesson).filter(
        Lesson.instructor_id == instructor.id,
        Lesson.id != lesson.id,
        Lesson.status == "pending_instructor",
        Lesson.scheduled_start < lesson.scheduled_end,
        Lesson.scheduled_end > lesson.scheduled_start
    ).all()
    for pending_conflict in pending_conflicts:
        pending_conflict.status = "cancelled"
        db.add(pending_conflict)

    # Instructor accepts: student must pay before lesson is fully confirmed.
    lesson.status = "pending_payment"
    ensure_pending_payment_record(db, lesson)

    db.add(lesson)
    db.add(instructor)
    create_notification(
        db,
        user_id=lesson.student_id,
        type="lesson_confirmed",
        title="Instrutor respondeu à sua solicitação",
        message=f"{instructor.name} aceitou sua solicitação de aula. Verifique o status em Meus Agendamentos.",
        lesson_id=lesson.id,
    )
    db.commit()
    db.refresh(lesson)

    student = db.get(User, lesson.student_id)
    return lesson_to_read(lesson, student, instructor)


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

    # Use same naive clock as booking/schedule writes (server local).
    now = datetime.now()
    window_start = lesson.scheduled_start - CODE_CONFIRM_GRACE
    window_end = lesson.scheduled_end + CODE_CONFIRM_GRACE
    if now < window_start:
        raise HTTPException(
            status_code=400,
            detail="Só é possível confirmar o código no horário da aula (ou até 30 min antes)"
        )
    if now > window_end:
        raise HTTPException(
            status_code=400,
            detail="Prazo para confirmar o código desta aula expirou"
        )

    lesson.status = "completed"
    lesson.code_confirmed_at = datetime.now()
    lesson.code_confirmed_by_instructor = True
    release_payment_for_lesson(db, lesson)

    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    student = db.get(User, lesson.student_id)
    return lesson_to_read(lesson, student, instructor)


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

    refund_payment_for_lesson(db, lesson)
    lesson.status = "cancelled"
    db.add(lesson)

    instructor = db.query(Instructor).filter(Instructor.id == lesson.instructor_id).first()
    if user.role == "student" and instructor is not None:
        create_notification(
            db,
            user_id=instructor.user_id,
            type="lesson_cancelled",
            title="Aula cancelada pelo aluno",
            message="Um aluno cancelou uma aula agendada.",
            lesson_id=lesson.id,
        )
    elif user.role == "instructor":
        create_notification(
            db,
            user_id=lesson.student_id,
            type="lesson_cancelled",
            title="Aula cancelada pelo instrutor",
            message="O instrutor cancelou sua aula agendada.",
            lesson_id=lesson.id,
        )

    db.commit()
    db.refresh(lesson)

    student = db.get(User, lesson.student_id)
    return lesson_to_read(lesson, student, instructor)


@router.delete("/cancelled")
def clear_cancelled_lessons(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Remove cancelled lessons from the current user's history (student or instructor view)."""
    if user.role == "student":
        lessons = db.query(Lesson).filter(
            Lesson.student_id == user.id,
            Lesson.status == "cancelled"
        ).all()
    elif user.role == "instructor":
        instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
        if not instructor:
            raise HTTPException(status_code=404, detail="Instrutor não encontrado")
        lessons = db.query(Lesson).filter(
            Lesson.instructor_id == instructor.id,
            Lesson.status == "cancelled"
        ).all()
    else:
        raise HTTPException(status_code=403, detail="Sem permissão para limpar aulas canceladas")

    if not lessons:
        return {"deleted": 0}

    lesson_ids = [lesson.id for lesson in lessons]
    db.query(Review).filter(Review.lesson_id.in_(lesson_ids)).delete(synchronize_session=False)
    for lesson in lessons:
        db.delete(lesson)
    db.commit()

    return {"deleted": len(lesson_ids)}
