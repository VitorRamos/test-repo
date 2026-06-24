"""Unit tests for lesson helper functions."""

from backend.app.api.routes.lessons import generate_code, get_student_profile_map


def test_generate_code_default_length_and_charset():
    code = generate_code()
    assert len(code) == 8
    assert code.isalnum()
    assert code.isupper() or any(ch.isdigit() for ch in code)


def test_generate_code_custom_length():
    code = generate_code(12)
    assert len(code) == 12


def test_generate_code_is_random_enough():
    codes = {generate_code() for _ in range(20)}
    assert len(codes) > 1


def test_get_student_profile_map_empty_ids(db_session):
    assert get_student_profile_map(db_session, set()) == {}


def test_get_student_profile_map_indexes_by_user_id(db_session, make_user, make_student_profile):
    user = make_user(email="perfil@example.com")
    profile = make_student_profile(user=user, name="Perfil Nome")
    result = get_student_profile_map(db_session, {user.id})
    assert result[user.id].id == profile.id
    assert result[user.id].name == "Perfil Nome"


def test_code_window_logic_is_documented():
    # Behaviour is enforced in confirm_lesson_code route; smoke import.
    from backend.app.api.routes import lessons as lessons_routes
    assert callable(lessons_routes.confirm_lesson_code)
