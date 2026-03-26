from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.availability_utils import get_availability_weekdays, iter_candidate_slots
from backend.app.api.deps import get_db, get_current_user
from backend.app.models.instructor import Instructor
from backend.app.models.lesson import Lesson
from backend.app.models.user import User
from backend.app.models.review import Review
from backend.app.models.availability import Availability
from backend.app.schemas.instructor import InstructorCreate, InstructorRead
from backend.app.schemas.availability import AvailabilityCreate, AvailabilityRead
from backend.app.schemas.lesson import LessonRead
from backend.app.schemas.slot import AvailableDayRead

router = APIRouter()


def get_available_slots_for_instructor(
    db: Session,
    instructor_id: str,
    duration_hours: float,
    date_from: date | None = None,
    date_to: date | None = None,
    days_to_show: int = 21
) -> list[dict[str, object]]:
    now = datetime.now()
    start_date = date_from or now.date()
    end_date = date_to or (now + timedelta(days=days_to_show - 1)).date()
    availability = db.query(Availability).filter(Availability.instructor_id == instructor_id).all()
    booked_lessons = db.query(Lesson).filter(
        Lesson.instructor_id == instructor_id,
        Lesson.status.in_(["confirmed", "completed", "pending_payment"])
    ).all()
    return iter_candidate_slots(
        availability=availability,
        booked_lessons=booked_lessons,
        duration_hours=duration_hours,
        date_from=start_date,
        date_to=end_date,
        now=now
    )


def availability_to_read(availability: Availability) -> AvailabilityRead:
    return AvailabilityRead(
        id=availability.id,
        instructor_id=availability.instructor_id,
        weekday=availability.weekday,
        start_date=availability.start_date,
        end_date=availability.end_date,
        weekdays=get_availability_weekdays(availability),
        start_time=availability.start_time,
        end_time=availability.end_time,
        created_at=availability.created_at
    )


@router.post("/", response_model=InstructorRead)
def become_instructor(
    data: InstructorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
    if instructor:
        raise HTTPException(status_code=400, detail="Usuário já é instrutor")

    instructor = Instructor(
        **data.model_dump(exclude={"email", "password"}),
        user_id=user.id
    )

    user.role = "instructor"
    db.add(user)
    db.add(instructor)
    db.commit()
    db.refresh(instructor)

    return instructor


@router.get("/", response_model=list[InstructorRead])
def search_instructors(
    db: Session = Depends(get_db),
    city: str = Query(None),
    price_max: float = Query(None),
    rating_min: float = Query(None),
):
    query = db.query(Instructor).filter(Instructor.active)
    
    if city:
        query = query.filter(Instructor.city.ilike(f"%{city}%"))
    
    if price_max is not None:
        query = query.filter(Instructor.price_per_hour <= price_max)
    
    if rating_min is not None:
        query = query.filter(Instructor.rating >= rating_min)
    
    return query.all()

@router.get("/my-lessons")
def get_my_lessons(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get lessons for the current instructor"""
    # Get instructor info
    instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
    if not instructor:
        return []
    
    # Get all lessons for this instructor
    lessons = db.query(Lesson).filter(Lesson.instructor_id == instructor.id).all()
    student_ids = {lesson.student_id for lesson in lessons}
    students = db.query(User).filter(User.id.in_(student_ids)).all() if student_ids else []
    student_map = {student.id: student for student in students}

    lesson_ids = {lesson.id for lesson in lessons}
    reviews = db.query(Review).filter(Review.lesson_id.in_(lesson_ids)).all() if lesson_ids else []
    review_map = {review.lesson_id: review for review in reviews}

    lesson_reads: list[LessonRead] = []
    for lesson in lessons:
        student = student_map.get(lesson.student_id)
        review = review_map.get(lesson.id)
        lesson_reads.append(
            LessonRead(
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
                student_email=student.email if student else None,
                instructor_name=instructor.name,
                has_review=review is not None,
                review_rating=review.rating if review else None,
                review_comment=review.comment if review else None,
                review_is_public=review.is_public if review else None,
                created_at=lesson.created_at
            )
        )

    return lesson_reads


@router.get("/earnings")
def get_earnings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get earnings summary for the current instructor"""
    # Get instructor info
    instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
    if not instructor:
        return {
            "total_earnings": 0,
            "pending_earnings": 0,
            "completed_lessons": 0
        }
    
    # Calculate earnings from completed lessons
    completed_lessons = db.query(Lesson).filter(
        Lesson.instructor_id == instructor.id,
        Lesson.status == "completed"
    ).all()
    
    pending_lessons = db.query(Lesson).filter(
        Lesson.instructor_id == instructor.id,
        Lesson.status.in_(["pending_instructor", "confirmed", "pending_payment"])
    ).all()
    
    total_earnings = sum(lesson.total_price for lesson in completed_lessons) * 0.8  # 20% fee
    pending_earnings = sum(lesson.total_price for lesson in pending_lessons) * 0.8
    
    return {
        "total_earnings": total_earnings,
        "pending_earnings": pending_earnings,
        "completed_lessons": len(completed_lessons),
        "total_lessons": len(completed_lessons) + len(pending_lessons)
    }


@router.get("/stats")
def get_instructor_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get instructor statistics"""
    instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
    if not instructor:
        return {
            "total_lessons": 0,
            "rating": 0,
            "students_taught": 0
        }
    
    counted_lessons = db.query(Lesson).filter(
        Lesson.instructor_id == instructor.id,
        Lesson.status.in_(["confirmed", "completed", "pending_payment"])
    ).all()
    unique_students = len(set(lesson.student_id for lesson in counted_lessons))
    
    return {
        "instructor_id": instructor.id,
        "total_lessons": len(counted_lessons),
        "rating": instructor.rating,
        "students_taught": unique_students,
        "name": instructor.name,
        "city": instructor.city,
        "state": instructor.state,
        "price_per_hour": instructor.price_per_hour
    }


@router.get("/availability", response_model=list[AvailabilityRead])
def get_availability(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instrutor não encontrado")
    availability = db.query(Availability).filter(Availability.instructor_id == instructor.id).all()
    return [availability_to_read(slot) for slot in availability]


@router.post("/availability", response_model=list[AvailabilityRead])
def create_availability(
    data: AvailabilityCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instrutor não encontrado")

    created_entries: list[Availability] = []
    weekdays_text = ",".join(str(day) for day in data.weekdays)
    for time_range in data.time_ranges:
        availability = Availability(
            instructor_id=instructor.id,
            weekday=data.weekdays[0],
            start_date=data.start_date,
            end_date=data.end_date,
            days_of_week=weekdays_text,
            start_time=time_range.start_time,
            end_time=time_range.end_time
        )
        db.add(availability)
        created_entries.append(availability)

    db.commit()
    for availability in created_entries:
        db.refresh(availability)
    return [availability_to_read(slot) for slot in created_entries]


@router.delete("/availability/{availability_id}")
def delete_availability(
    availability_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    instructor = db.query(Instructor).filter(Instructor.user_id == user.id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instrutor não encontrado")

    availability = db.query(Availability).filter(Availability.id == availability_id).first()
    if not availability or availability.instructor_id != instructor.id:
        raise HTTPException(status_code=404, detail="Disponibilidade não encontrada")

    db.delete(availability)
    db.commit()
    return {"status": "ok"}


@router.get("/{instructor_id}/available-slots", response_model=list[AvailableDayRead])
def get_public_available_slots(
    instructor_id: str,
    duration_hours: float = Query(1, gt=0),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    db: Session = Depends(get_db)
):
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instrutor não encontrado")
    if date_from and date_to and date_to < date_from:
        raise HTTPException(status_code=400, detail="A data final deve ser maior ou igual à inicial")
    return get_available_slots_for_instructor(db, str(instructor.id), duration_hours, date_from, date_to)


@router.get("/{instructor_id}", response_model=InstructorRead)
def get_instructor(
    instructor_id: str,
    db: Session = Depends(get_db)
):
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instrutor não encontrado")
    return instructor
