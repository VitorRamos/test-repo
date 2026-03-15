from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db
from backend.app.schemas.auth import LoginRequest, TokenResponse
from backend.app.schemas.user import UserCreate
from backend.app.models.user import User
from backend.app.core.security import verify_password, hash_password, create_access_token

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):

    user = db.query(User).filter(User.email == data.email).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(str(user.id))

    return {"access_token": token}

@router.post("/register")
def register(data: UserCreate, db: Session = Depends(get_db)):

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role="student"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user