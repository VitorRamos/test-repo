from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db
from backend.app.schemas.instructor import InstructorCreate, InstructorRead
from backend.app.models.instructor import Instructor
from backend.app.api.deps import get_current_user
from backend.app.models.user import User

router = APIRouter()

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

@router.post("/", response_model=InstructorRead)
def create_instructor(
    data: InstructorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    instructor = db.query(Instructor).filter(Instructor.cpf == data.cpf).first()
    if not instructor:
        raise HTTPException(status_code=404, detail="Instructor with this CPF already exists")
        
    instructor = Instructor(
        **data.model_dump(),
        user_id=user.id
    )

    db.add(instructor)
    db.commit()
    db.refresh(instructor)

    return instructor