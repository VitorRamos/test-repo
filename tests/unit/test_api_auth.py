"""API tests for authentication endpoints."""

import uuid


def test_register_and_login(client):
    email = f"aluno_{uuid.uuid4().hex[:8]}@example.com"
    register = client.post("/api/auth/register", json={"email": email, "password": "senha12345"})
    assert register.status_code == 200
    assert register.json()["email"] == email
    assert register.json()["role"] == "student"

    login = client.post("/api/auth/login", data={"username": email, "password": "senha12345"})
    assert login.status_code == 200
    body = login.json()
    assert "access_token" in body
    assert body["email"] == email
    assert body["role"] == "student"


def test_register_duplicate_email_rejected(client):
    email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
    assert client.post("/api/auth/register", json={"email": email, "password": "senha12345"}).status_code == 200
    again = client.post("/api/auth/register", json={"email": email, "password": "outra_senha"})
    assert again.status_code == 400


def test_login_invalid_credentials(client):
    email = f"bad_{uuid.uuid4().hex[:8]}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "senha12345"})
    response = client.post("/api/auth/login", data={"username": email, "password": "errada"})
    assert response.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_returns_current_user(client, make_user, auth_headers):
    user = make_user(email=f"me_{uuid.uuid4().hex[:8]}@example.com")
    headers = auth_headers(client, user.email)
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    assert response.json()["email"] == user.email
    assert response.json()["role"] == "student"


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
