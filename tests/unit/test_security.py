"""Unit tests for password hashing and JWT helpers."""

from jose import jwt

from backend.app.core.security import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password_roundtrip():
    hashed = hash_password("minha_senha_forte")
    assert hashed != "minha_senha_forte"
    assert verify_password("minha_senha_forte", hashed) is True
    assert verify_password("outra_senha", hashed) is False


def test_create_access_token_embeds_user_id():
    token = create_access_token("user-123")
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "user-123"
    assert "exp" in payload
