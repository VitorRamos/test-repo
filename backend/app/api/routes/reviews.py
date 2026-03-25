from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, get_current_user
from backend.app.models.lesson import Lesson
from backend.app.models.review import Review
from backend.app.models.instructor import Instructor
from backend.app.models.user import User
from backend.app.schemas.review import ReviewCreate, ReviewRead, ReviewUpdate

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
        comment=data.comment,
        is_public=data.is_public
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


@router.get("/lesson/{lesson_id}", response_model=ReviewRead)
def get_review_for_lesson(
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Apenas alunos podem ver avaliações")

    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson or lesson.student_id != user.id:
        raise HTTPException(status_code=404, detail="Aula não encontrada")

    review = db.query(Review).filter(Review.lesson_id == lesson.id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    return ReviewRead(
        id=review.id,
        lesson_id=review.lesson_id,
        student_id=review.student_id,
        instructor_id=review.instructor_id,
        rating=review.rating,
        comment=review.comment,
        student_email=user.email,
        is_public=review.is_public,
        created_at=review.created_at
    )


@router.put("/{review_id}", response_model=ReviewRead)
def update_review(
    review_id: str,
    data: ReviewUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Apenas alunos podem editar avaliações")

    review = db.query(Review).filter(Review.id == review_id).first()
    if not review or review.student_id != user.id:
        raise HTTPException(status_code=404, detail="Avaliação não encontrada")

    lesson = db.query(Lesson).filter(Lesson.id == review.lesson_id).first()
    if not lesson or lesson.status != "completed":
        raise HTTPException(status_code=400, detail="Aula ainda não foi concluída")

    review.rating = data.rating
    review.comment = data.comment
    review.is_public = data.is_public

    # Recalculate instructor rating
    reviews = db.query(Review).filter(Review.instructor_id == review.instructor_id).all()
    if reviews:
        total = sum(r.rating for r in reviews)
        instructor = db.query(Instructor).filter(Instructor.id == review.instructor_id).first()
        if instructor:
            instructor.rating = total / len(reviews)
            db.add(instructor)

    db.add(review)
    db.commit()
    db.refresh(review)

    return ReviewRead(
        id=review.id,
        lesson_id=review.lesson_id,
        student_id=review.student_id,
        instructor_id=review.instructor_id,
        rating=review.rating,
        comment=review.comment,
        student_email=user.email,
        is_public=review.is_public,
        created_at=review.created_at
    )


@router.get("/instructor/{instructor_id}", response_model=list[ReviewRead])
def get_reviews_for_instructor(
    instructor_id: str,
    db: Session = Depends(get_db)
):
    reviews = db.query(Review).filter(Review.instructor_id == instructor_id).order_by(Review.created_at.desc()).all()
    student_ids = {review.student_id for review in reviews}
    students = db.query(User).filter(User.id.in_(student_ids)).all() if student_ids else []
    student_map = {student.id: student for student in students}

    return [
        ReviewRead(
            id=review.id,
            lesson_id=review.lesson_id,
            student_id=review.student_id,
            instructor_id=review.instructor_id,
            rating=review.rating,
            comment=review.comment,
            student_email=student_map.get(review.student_id).email if student_map.get(review.student_id) else None,
            is_public=review.is_public,
            created_at=review.created_at
        )
        for review in reviews
    ]


@router.get("/public/{instructor_id}", response_model=list[ReviewRead])
def get_public_reviews_for_instructor(
    instructor_id: str,
    db: Session = Depends(get_db)
):
    reviews = db.query(Review).filter(
        Review.instructor_id == instructor_id,
        Review.is_public
    ).order_by(Review.created_at.desc()).all()

    return [
        ReviewRead(
            id=review.id,
            lesson_id=review.lesson_id,
            student_id=review.student_id,
            instructor_id=review.instructor_id,
            rating=review.rating,
            comment=review.comment,
            student_email=None,
            is_public=review.is_public,
            created_at=review.created_at
        )
        for review in reviews
    ]
