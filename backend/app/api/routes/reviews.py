from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, get_current_user
from backend.app.models.lesson import Lesson
from backend.app.models.review import Review
from backend.app.models.instructor import Instructor
from backend.app.models.user import User
from backend.app.schemas.review import ReviewCreate, ReviewRead

router = APIRouter()


@router.post("/", response_model=ReviewRead)
def create_review(
    data: ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Apenas alunos podem avaliar aulas")

    lesson = db.query(Lesson).filter(Lesson.id == data.lesson_id).first()
    if not lesson or lesson.student_id != user.id:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    if lesson.status != "completed":
        raise HTTPException(status_code=400, detail="Aula ainda não foi concluída")

    existing = db.query(Review).filter(Review.lesson_id == lesson.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Aula já foi avaliada")

    review = Review(
        lesson_id=lesson.id,
        student_id=user.id,
        instructor_id=lesson.instructor_id,
        rating=data.rating,
        comment=data.comment
    )
    db.add(review)

    # Update instructor rating (simple average)
    reviews = db.query(Review).filter(Review.instructor_id == lesson.instructor_id).all()
    total = sum(r.rating for r in reviews) + data.rating
    count = len(reviews) + 1
    instructor = db.query(Instructor).filter(Instructor.id == lesson.instructor_id).first()
    if instructor:
        instructor.rating = total / count
        db.add(instructor)

    db.commit()
    db.refresh(review)

    return review
