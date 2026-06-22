"""Unit tests for student display name resolution."""

from datetime import datetime
from uuid import uuid4

from backend.app.api.routes.lessons import lesson_to_read, resolve_student_name
from backend.app.models.instructor import Instructor
from backend.app.models.lesson import Lesson
from backend.app.models.student import Student
from backend.app.models.user import User


def _user(email: str | None = "joao@example.com") -> User:
    return User(
        id=uuid4(),
        email=email or "unused@example.com",
        password_hash="hash",
        role="student",
    )


def _profile(name: str, user_id=None) -> Student:
    return Student(
        id=uuid4(),
        user_id=user_id or uuid4(),
        name=name,
        cpf="52998224725",
        license_category="B",
    )


def test_resolve_student_name_prefers_profile_name():
    user = _user("fallback@example.com")
    profile = _profile("Maria Silva", user_id=user.id)
    assert resolve_student_name(user, profile) == "Maria Silva"


def test_resolve_student_name_falls_back_to_email_local_part():
    user = _user("aluno.maria_abc@example.com")
    assert resolve_student_name(user, None) == "aluno.maria_abc"


def test_resolve_student_name_returns_none_when_missing_data():
    assert resolve_student_name(None, None) is None


def test_resolve_student_name_empty_profile_name_uses_email():
    user = _user("sem.nome@example.com")
    profile = _profile("", user_id=user.id)
    assert resolve_student_name(user, profile) == "sem.nome"


def test_lesson_to_read_includes_student_name_and_email():
    student = _user("contato@example.com")
    profile = _profile("Ana Costa", user_id=student.id)
    instructor = Instructor(
        id=uuid4(),
        user_id=uuid4(),
        name="Instrutor X",
        cpf="52998224725",
        detran_license="DET123456",
        price_per_hour=90.0,
        city="SP",
        state="SP",
    )
    now = datetime(2026, 6, 23, 9, 0, 0)
    lesson = Lesson(
        id=uuid4(),
        student_id=student.id,
        instructor_id=instructor.id,
        scheduled_start=now,
        scheduled_end=now.replace(hour=10),
        hour_price=90.0,
        total_price=90.0,
        status="pending_instructor",
        code_confirmed_by_instructor=False,
        created_at=now,
    )

    payload = lesson_to_read(lesson, student, instructor, student_profile=profile)

    assert payload.student_name == "Ana Costa"
    assert payload.student_email == "contato@example.com"
    assert payload.instructor_name == "Instrutor X"
    assert payload.has_review is False
