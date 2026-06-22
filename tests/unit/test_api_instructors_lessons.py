"""API tests for instructors and lessons, including student name/contact in lists."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta


def _register_login(client, email: str, password: str = "senha12345") -> dict[str, str]:
    client.post("/api/auth/register", json={"email": email, "password": password})
    login = client.post("/api/auth/login", data={"username": email, "password": password})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _become_instructor(client, headers: dict[str, str], name: str = "Instrutor API") -> dict:
    response = client.post(
        "/api/instructors/",
        headers=headers,
        json={
            "name": name,
            "cpf": "52998224725",
            "detran_license": f"DET{uuid.uuid4().hex[:8].upper()}",
            "price_per_hour": 85,
            "city": "São Paulo",
            "state": "SP",
            "bio": "Experiente",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def _publish_availability(client, headers: dict[str, str], day: date | None = None) -> None:
    target = day or (datetime.now().date() + timedelta(days=2))
    js_weekday = (target.weekday() + 1) % 7
    response = client.post(
        "/api/instructors/availability",
        headers=headers,
        json={
            "start_date": target.isoformat(),
            "end_date": target.isoformat(),
            "weekdays": [js_weekday],
            "time_ranges": [{"start_time": "08:00", "end_time": "12:00"}],
        },
    )
    assert response.status_code == 200, response.text


def test_create_instructor_and_list(client):
    inst_email = f"inst_list_{uuid.uuid4().hex[:8]}@example.com"
    headers = _register_login(client, inst_email)
    instructor = _become_instructor(client, headers, name="Listado")
    listed = client.get("/api/instructors/")
    assert listed.status_code == 200
    ids = [item["id"] for item in listed.json()]
    assert instructor["id"] in ids


def test_my_lessons_includes_student_name_and_email_fallback(client):
    inst_email = f"inst_ml_{uuid.uuid4().hex[:8]}@example.com"
    inst_headers = _register_login(client, inst_email)
    instructor = _become_instructor(client, inst_headers)

    day = datetime.now().date() + timedelta(days=3)
    _publish_availability(client, inst_headers, day=day)

    stu_email = f"aluno.contato_{uuid.uuid4().hex[:8]}@example.com"
    stu_headers = _register_login(client, stu_email)
    scheduled = datetime.combine(day, datetime.strptime("09:00", "%H:%M").time())
    booked = client.post(
        "/api/lessons/book",
        headers=stu_headers,
        json={
            "instructor_id": instructor["id"],
            "scheduled_start": scheduled.isoformat(),
            "duration_hours": 1,
        },
    )
    assert booked.status_code == 200, booked.text

    lessons = client.get("/api/instructors/my-lessons", headers=inst_headers)
    assert lessons.status_code == 200
    payload = lessons.json()
    assert len(payload) >= 1
    lesson = next(item for item in payload if item["id"] == booked.json()["id"])

    assert lesson["student_email"] == stu_email
    assert lesson["student_name"] == stu_email.split("@", 1)[0]
    assert lesson["instructor_name"]


def test_my_lessons_uses_student_profile_name_when_present(
    client, db_session, make_user, make_instructor, make_student_profile, make_availability, make_lesson, auth_headers
):
    instructor_user = make_user(role="instructor", email=f"inst_prof_{uuid.uuid4().hex[:8]}@example.com")
    instructor = make_instructor(user=instructor_user, name="Instrutor Perfil")
    student_user = make_user(email=f"stu_prof_{uuid.uuid4().hex[:8]}@example.com")
    make_student_profile(user=student_user, name="João Perfil")
    day = datetime.now().date() + timedelta(days=4)
    make_availability(instructor=instructor, target_date=day)
    lesson = make_lesson(
        student=student_user,
        instructor=instructor,
        scheduled_start=datetime.combine(day, datetime.strptime("10:00", "%H:%M").time()),
    )

    headers = auth_headers(client, instructor_user.email)
    response = client.get("/api/instructors/my-lessons", headers=headers)
    assert response.status_code == 200
    found = next(item for item in response.json() if item["id"] == str(lesson.id))
    assert found["student_name"] == "João Perfil"
    assert found["student_email"] == student_user.email


def test_student_cannot_access_my_lessons_as_empty_when_not_instructor(client):
    email = f"only_stu_{uuid.uuid4().hex[:8]}@example.com"
    headers = _register_login(client, email)
    response = client.get("/api/instructors/my-lessons", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


def test_book_lesson_requires_student_role(client):
    inst_email = f"inst_role_{uuid.uuid4().hex[:8]}@example.com"
    inst_headers = _register_login(client, inst_email)
    instructor = _become_instructor(client, inst_headers)
    day = datetime.now().date() + timedelta(days=5)
    _publish_availability(client, inst_headers, day=day)

    scheduled = datetime.combine(day, datetime.strptime("09:00", "%H:%M").time())
    response = client.post(
        "/api/lessons/book",
        headers=inst_headers,
        json={
            "instructor_id": instructor["id"],
            "scheduled_start": scheduled.isoformat(),
            "duration_hours": 1,
        },
    )
    assert response.status_code == 403


def test_book_lesson_returns_student_contact_fields(client):
    inst_email = f"inst_flow_{uuid.uuid4().hex[:8]}@example.com"
    inst_headers = _register_login(client, inst_email)
    instructor = _become_instructor(client, inst_headers)
    day = datetime.now().date() + timedelta(days=6)
    _publish_availability(client, inst_headers, day=day)

    stu_email = f"stu_flow_{uuid.uuid4().hex[:8]}@example.com"
    stu_headers = _register_login(client, stu_email)
    scheduled = datetime.combine(day, datetime.strptime("09:00", "%H:%M").time())
    booked = client.post(
        "/api/lessons/book",
        headers=stu_headers,
        json={
            "instructor_id": instructor["id"],
            "scheduled_start": scheduled.isoformat(),
            "duration_hours": 1,
        },
    )
    assert booked.status_code == 200
    body = booked.json()
    assert body["status"] == "pending_instructor"
    assert body["student_email"] == stu_email
    assert body["student_name"] == stu_email.split("@", 1)[0]
    assert body["instructor_name"] == instructor["name"]


def test_clear_cancelled_lessons_as_student(
    client, make_user, make_instructor, make_lesson, auth_headers
):
    instructor_user = make_user(role="instructor", email=f"inst_clr_{uuid.uuid4().hex[:8]}@example.com")
    instructor = make_instructor(user=instructor_user)
    student_user = make_user(email=f"stu_clr_{uuid.uuid4().hex[:8]}@example.com")
    other_student = make_user(email=f"stu_clr_other_{uuid.uuid4().hex[:8]}@example.com")

    cancelled = make_lesson(student=student_user, instructor=instructor, status="cancelled")
    pending = make_lesson(
        student=student_user,
        instructor=instructor,
        status="pending_instructor",
        scheduled_start=datetime.now() + timedelta(days=2),
    )
    other_cancelled = make_lesson(
        student=other_student,
        instructor=instructor,
        status="cancelled",
        scheduled_start=datetime.now() + timedelta(days=3),
    )
    cancelled_id = str(cancelled.id)
    pending_id = str(pending.id)
    other_cancelled_id = str(other_cancelled.id)

    headers = auth_headers(client, student_user.email)
    response = client.delete("/api/lessons/cancelled", headers=headers)
    assert response.status_code == 200
    assert response.json()["deleted"] == 1

    bookings = client.get("/api/lessons/my-bookings", headers=headers)
    assert bookings.status_code == 200
    ids = {item["id"] for item in bookings.json()}
    assert cancelled_id not in ids
    assert pending_id in ids

    other_headers = auth_headers(client, other_student.email)
    other_bookings = client.get("/api/lessons/my-bookings", headers=other_headers)
    other_ids = {item["id"] for item in other_bookings.json()}
    assert other_cancelled_id in other_ids


def test_clear_cancelled_lessons_as_instructor(
    client, make_user, make_instructor, make_lesson, auth_headers
):
    instructor_user = make_user(role="instructor", email=f"inst_clr_i_{uuid.uuid4().hex[:8]}@example.com")
    instructor = make_instructor(user=instructor_user)
    other_instructor_user = make_user(
        role="instructor", email=f"inst_clr_o_{uuid.uuid4().hex[:8]}@example.com"
    )
    other_instructor = make_instructor(user=other_instructor_user, name="Outro Instrutor")
    student_user = make_user(email=f"stu_clr_i_{uuid.uuid4().hex[:8]}@example.com")

    cancelled = make_lesson(student=student_user, instructor=instructor, status="cancelled")
    completed = make_lesson(
        student=student_user,
        instructor=instructor,
        status="completed",
        scheduled_start=datetime.now() + timedelta(days=2),
    )
    other_cancelled = make_lesson(
        student=student_user,
        instructor=other_instructor,
        status="cancelled",
        scheduled_start=datetime.now() + timedelta(days=3),
    )
    cancelled_id = str(cancelled.id)
    completed_id = str(completed.id)
    other_cancelled_id = str(other_cancelled.id)

    headers = auth_headers(client, instructor_user.email)
    response = client.delete("/api/lessons/cancelled", headers=headers)
    assert response.status_code == 200
    assert response.json()["deleted"] == 1

    lessons = client.get("/api/instructors/my-lessons", headers=headers)
    assert lessons.status_code == 200
    ids = {item["id"] for item in lessons.json()}
    assert cancelled_id not in ids
    assert completed_id in ids

    other_headers = auth_headers(client, other_instructor_user.email)
    other_lessons = client.get("/api/instructors/my-lessons", headers=other_headers)
    other_ids = {item["id"] for item in other_lessons.json()}
    assert other_cancelled_id in other_ids


def test_clear_cancelled_returns_zero_when_empty(client):
    email = f"stu_clr_empty_{uuid.uuid4().hex[:8]}@example.com"
    headers = _register_login(client, email)
    response = client.delete("/api/lessons/cancelled", headers=headers)
    assert response.status_code == 200
    assert response.json()["deleted"] == 0


def test_my_bookings_for_student(client):
    inst_email = f"inst_mb_{uuid.uuid4().hex[:8]}@example.com"
    inst_headers = _register_login(client, inst_email)
    instructor = _become_instructor(client, inst_headers)
    day = datetime.now().date() + timedelta(days=7)
    _publish_availability(client, inst_headers, day=day)

    stu_email = f"stu_mb_{uuid.uuid4().hex[:8]}@example.com"
    stu_headers = _register_login(client, stu_email)
    scheduled = datetime.combine(day, datetime.strptime("09:00", "%H:%M").time())
    booked = client.post(
        "/api/lessons/book",
        headers=stu_headers,
        json={
            "instructor_id": instructor["id"],
            "scheduled_start": scheduled.isoformat(),
            "duration_hours": 1,
        },
    )
    assert booked.status_code == 200

    bookings = client.get("/api/lessons/my-bookings", headers=stu_headers)
    assert bookings.status_code == 200
    assert any(item["id"] == booked.json()["id"] for item in bookings.json())
