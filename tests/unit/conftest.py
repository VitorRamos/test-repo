"""Shared fixtures for unit and API tests (in-memory SQLite)."""

from __future__ import annotations

import os

# Ensure importing backend.app.main does not require a live Postgres instance.
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

from collections.abc import Generator
from datetime import date, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.api.deps import get_db
from backend.app.api.routes import auth, instructors, lessons, reviews
from backend.app.core.security import hash_password
from backend.app.db.base import Base
from backend.app.models.availability import Availability
from backend.app.models.instructor import Instructor
from backend.app.models.lesson import Lesson
from backend.app.models.student import Student
from backend.app.models.user import User

# Import remaining models so metadata is complete
import backend.app.models.payment  # noqa: F401
import backend.app.models.review  # noqa: F401


def _build_test_app() -> FastAPI:
    """Minimal FastAPI app without production DB bootstrap side effects."""
    test_app = FastAPI()
    test_app.include_router(instructors.router, prefix="/api/instructors", tags=["instructors"])
    test_app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    test_app.include_router(lessons.router, prefix="/api/lessons", tags=["lessons"])
    test_app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])

    @test_app.get("/api/health")
    def health():
        return {"status": "ok"}

    return test_app


app = _build_test_app()


@pytest.fixture()
def db_engine():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def db_session(db_engine) -> Generator[Session, None, None]:
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_engine) -> Generator[TestClient, None, None]:
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db() -> Generator[Session, None, None]:
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def make_user(db_session: Session):
    def _make_user(
        *,
        email: str | None = None,
        password: str = "senha12345",
        role: str = "student",
        active: bool = True,
    ) -> User:
        user = User(
            id=uuid4(),
            email=email or f"user_{uuid4().hex[:8]}@example.com",
            password_hash=hash_password(password),
            role=role,
            active=active,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _make_user


@pytest.fixture()
def make_instructor(db_session: Session, make_user):
    def _make_instructor(
        *,
        user: User | None = None,
        name: str = "Instrutor Teste",
        price_per_hour: float = 80.0,
        active: bool = True,
    ) -> Instructor:
        owner = user or make_user(role="instructor", email=f"inst_{uuid4().hex[:8]}@example.com")
        instructor = Instructor(
            id=uuid4(),
            user_id=owner.id,
            name=name,
            cpf="52998224725",
            detran_license="DET123456",
            price_per_hour=price_per_hour,
            city="São Paulo",
            state="SP",
            bio="Bio",
            rating=0.0,
            total_lessons=0,
            active=active,
        )
        db_session.add(instructor)
        db_session.commit()
        db_session.refresh(instructor)
        return instructor

    return _make_instructor


@pytest.fixture()
def make_student_profile(db_session: Session):
    def _make_student_profile(
        *,
        user: User,
        name: str = "Maria Silva",
        cpf: str = "52998224725",
        license_category: str = "B",
    ) -> Student:
        profile = Student(
            id=uuid4(),
            user_id=user.id,
            name=name,
            cpf=cpf,
            license_category=license_category,
        )
        db_session.add(profile)
        db_session.commit()
        db_session.refresh(profile)
        return profile

    return _make_student_profile


@pytest.fixture()
def make_availability(db_session: Session):
    def _make_availability(
        *,
        instructor: Instructor,
        target_date: date | None = None,
        start_time: str = "08:00",
        end_time: str = "12:00",
        weekdays: list[int] | None = None,
    ) -> Availability:
        day = target_date or (datetime.now().date() + timedelta(days=1))
        # Frontend/JS weekday convention (Sunday=0) used by availability_matches_date
        js_weekday = (day.weekday() + 1) % 7
        days = weekdays if weekdays is not None else [js_weekday]
        slot = Availability(
            id=uuid4(),
            instructor_id=instructor.id,
            weekday=days[0],
            start_date=day,
            end_date=day,
            days_of_week=",".join(str(d) for d in days),
            start_time=start_time,
            end_time=end_time,
        )
        db_session.add(slot)
        db_session.commit()
        db_session.refresh(slot)
        return slot

    return _make_availability


@pytest.fixture()
def make_lesson(db_session: Session):
    def _make_lesson(
        *,
        student: User,
        instructor: Instructor,
        status: str = "pending_instructor",
        scheduled_start: datetime | None = None,
        duration_hours: float = 1.0,
        hour_price: float | None = None,
        confirmation_code: str | None = None,
    ) -> Lesson:
        start = scheduled_start or (datetime.now() + timedelta(days=1)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
        price = hour_price if hour_price is not None else instructor.price_per_hour
        lesson = Lesson(
            id=uuid4(),
            student_id=student.id,
            instructor_id=instructor.id,
            scheduled_start=start,
            scheduled_end=start + timedelta(hours=duration_hours),
            hour_price=price,
            total_price=price * duration_hours,
            status=status,
            confirmation_code=confirmation_code,
        )
        db_session.add(lesson)
        db_session.commit()
        db_session.refresh(lesson)
        return lesson

    return _make_lesson


@pytest.fixture()
def auth_headers():
    def _auth_headers(client: TestClient, email: str, password: str = "senha12345") -> dict[str, str]:
        response = client.post(
            "/api/auth/login",
            data={"username": email, "password": password},
        )
        assert response.status_code == 200, response.text
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _auth_headers
