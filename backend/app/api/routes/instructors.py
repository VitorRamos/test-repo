from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, get_current_user
from backend.app.api.routes.auth import create_user
from backend.app.models.instructor import Instructor
from backend.app.models.lesson import Lesson
from backend.app.models.user import User
from backend.app.schemas.instructor import InstructorCreate, InstructorRead

router = APIRouter()


@router.post("/", response_model=InstructorRead)
def create_instructor(
    data: InstructorCreate,
    db: Session = Depends(get_db)
):
    instructor = db.query(Instructor).filter(Instructor.cpf == data.cpf).first()
    if instructor:
        raise HTTPException(status_code=400, detail="Instructor with this CPF already exists")

    user = create_user(db, data, "instructor")  # Reuse the registration logic to create the user
    
    instructor = Instructor(
        **data.model_dump(exclude={"email", "password"}),
        user_id=user.id
    )

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

@router.get("/{instructor_id}", response_model=InstructorRead)
def get_instructor(
    instructor_id: str,
    db: Session = Depends(get_db)
):
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor not found")
    return instructor

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
    return lessons


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
        Lesson.status.in_(["confirmed", "pending_payment"])
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
    
    lessons = db.query(Lesson).filter(Lesson.instructor_id == instructor.id).all()
    unique_students = len(set(lesson.student_id for lesson in lessons))
    
    return {
        "total_lessons": instructor.total_lessons,
        "rating": instructor.rating,
        "students_taught": unique_students,
        "name": instructor.name,
        "city": instructor.city,
        "state": instructor.state,
        "price_per_hour": instructor.price_per_hour
    }
