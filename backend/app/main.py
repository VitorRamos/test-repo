from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.app.api.routes import instructors
from backend.app.db.session import engine
from backend.app.db.base import Base
from backend.app.api.routes import auth

# import models so SQLAlchemy registers them
import backend.app.models.user
import backend.app.models.instructor
import backend.app.models.student
import backend.app.models.lesson
import backend.app.models.payment

app = FastAPI()

# create database tables (development only)
Base.metadata.create_all(bind=engine)

app.include_router(
    instructors.router,
    prefix="/api/instructors",
    tags=["instructors"]
)

app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["auth"]
)

@app.get("/api/health")
def health():
    return {"status": "ok"}

app.mount("/", StaticFiles(directory="frontend/dist", html=True))