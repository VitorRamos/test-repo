"""Unit tests for lesson helper functions."""

from datetime import datetime, timedelta

from backend.app.api.routes.lessons import (
    CODE_CONFIRM_GRACE,
    generate_code,
    get_student_profile_map,
    is_within_code_confirm_window,
)


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


def test_code_confirm_window_edges():
    start = datetime(2026, 6, 24, 10, 0, 0)
    end = datetime(2026, 6, 24, 11, 0, 0)
    grace = CODE_CONFIRM_GRACE

    assert is_within_code_confirm_window(start, end, now=start - grace)
    assert is_within_code_confirm_window(start, end, now=start)
    assert is_within_code_confirm_window(start, end, now=end)
    assert is_within_code_confirm_window(start, end, now=end + grace)

    assert not is_within_code_confirm_window(start, end, now=start - grace - timedelta(seconds=1))
    assert not is_within_code_confirm_window(start, end, now=end + grace + timedelta(seconds=1))
