from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db
from backend.app.schemas.instructor import InstructorCreate
from backend.app.models.instructor import Instructor

router = APIRouter()


@router.post("/")
def create_instructor(data: InstructorCreate, db: Session = Depends(get_db)):

    instructor = Instructor(**data.dict())

    db.add(instructor)
    db.commit()
    db.refresh(instructor)

    return instructor