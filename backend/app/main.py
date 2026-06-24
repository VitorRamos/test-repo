from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from backend.app.api.routes import instructors, auth, lessons, reviews, notifications, payments
from backend.app.db.session import engine
from backend.app.db.base import Base
from backend.app.db.schema import apply_development_schema_updates

# import models so SQLAlchemy registers them
import backend.app.models.user
import backend.app.models.instructor
import backend.app.models.student
import backend.app.models.lesson
import backend.app.models.payment
import backend.app.models.review
import backend.app.models.availability

app = FastAPI()

# create database tables (development only)
Base.metadata.create_all(bind=engine)
apply_development_schema_updates(engine)

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

app.include_router(
    lessons.router,
    prefix="/api/lessons",
    tags=["lessons"]
)

app.include_router(
    reviews.router,
    prefix="/api/reviews",
    tags=["reviews"]
)

app.include_router(
    notifications.router,
    prefix="/api/notifications",
    tags=["notifications"]
)

app.include_router(
    payments.router,
    prefix="/api/payments",
    tags=["payments"]
)

@app.get("/api/health")
def health():
    return {"status": "ok"}

# Mount static assets
app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

# Catch-all route for SPA - serve index.html for all non-API routes
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    index_path = "frontend/dist/index.html"
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"detail": "Not Found"}
