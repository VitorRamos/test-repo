# Tests

## Unit / API tests (pytest)

Fast tests using an in-memory SQLite database and FastAPI `TestClient`. No browser or running server required.

```bash
# from repo root
uv sync --extra dev
uv run pytest
# or explicitly:
uv run pytest tests/unit -v
```

Coverage includes:

- Student name/contact resolution (`resolve_student_name`, `lesson_to_read`)
- CPF and instructor schema validation
- Availability date/weekday matching
- Password hashing and JWT helpers
- Auth, instructors, and lessons API flows (including `GET /api/instructors/my-lessons` student fields)

## End-to-end tests (Selenium)

Browser tests in `tests/e2e.py`. Require frontend + backend running and Chrome/Selenium.

```bash
uv run python tests/e2e.py
# or a subset:
uv run python tests/e2e.py booking_flow conflict_booking
# calendar / agenda coverage:
uv run python tests/e2e.py calendar_drag_select calendar_tab_navigation calendar_selection_filter grouped_availability_removal
```

Calendar / agenda E2E coverage includes:

- Drag-select on the instructor central calendar (add range, remove range)
- Navigation between agenda tabs (`Disponibilidades`, `Solicitações`, `Confirmadas`)
- Agenda selection filter (`all`, `availability`, `lessons`)
- Grouped availability removal (single group and `Remover todas`)
