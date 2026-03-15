from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db
from backend.app.schemas.instructor import InstructorCreate
from backend.app.models.instructor import Instructor
from backend.app.api.deps import get_current_user
from backend.app.models.user import User

router = APIRouter()

@router.post("/")
def create_instructor(
    data: InstructorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):

    instructor = Instructor(
        **data.model_dump(),
        user_id=user.id
    )

    db.add(instructor)
    db.commit()
    db.refresh(instructor)

    return instructor