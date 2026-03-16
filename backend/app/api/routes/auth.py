from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db
from backend.app.schemas.auth import TokenResponse
from backend.app.schemas.user import UserCreate
from backend.app.models.user import User
from backend.app.core.security import verify_password, hash_password, create_access_token

router = APIRouter()

def create_user(db: Session, data: UserCreate, role: str = "student") -> User:
    existing = db.query(User).filter(User.email == data.email).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        role=role
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(str(user.id))

    return {
        "access_token": token,
        "token_type": "bearer",
        "email": user.email,
        "role": user.role
    }


@router.post("/register")
def register(data: UserCreate, db: Session = Depends(get_db)):
    return create_user(db, data)