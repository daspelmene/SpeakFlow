import pytest
from httpx import AsyncClient
from conftest import register_user   # <-- добавлен импорт

pytestmark = pytest.mark.asyncio

async def test_register_success(client: AsyncClient):
    resp = await client.post("/auth/register", json={
        "email": "new@example.com",
        "password": "pass123",
        "fullname": "New User",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.parametrize(
    "email",
    [
        "a@b/.c",
        "a@-example.com",
        "a@example-.com",
        "a@example",
    ],
)
async def test_register_rejects_invalid_email(client: AsyncClient, email: str):
    resp = await client.post("/auth/register", json={
        "email": email,
        "password": "pass123",
        "fullname": "Invalid Email",
    })

    assert resp.status_code == 422

async def test_register_duplicate_email(client: AsyncClient):
    await register_user(client, "dup@example.com", "pass", "Dup")
    resp = await client.post("/auth/register", json={
        "email": "dup@example.com",
        "password": "pass",
        "fullname": "Dup2",
    })
    assert resp.status_code == 409
    assert "already registered" in resp.text

async def test_login_success(client: AsyncClient):
    email, password = "login@example.com", "pass123"
    access_token, _ = await register_user(client, email, password, "Login")
    await client.post(
        "/auth/logout", headers={"Authorization": f"Bearer {access_token}"}
    )
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_login_replaces_active_session(client: AsyncClient):
    email, password = "active@example.com", "pass123"
    old_access_token, _ = await register_user(client, email, password, "Active")

    resp = await client.post("/auth/login", json={"email": email, "password": password})

    assert resp.status_code == 200

    old_session_resp = await client.get(
        "/users/me", headers={"Authorization": f"Bearer {old_access_token}"}
    )
    assert old_session_resp.status_code == 401


async def test_logout_allows_new_login_and_invalidates_old_token(client: AsyncClient):
    email, password = "logout@example.com", "pass123"
    old_access_token, _ = await register_user(client, email, password, "Logout")

    logout_resp = await client.post(
        "/auth/logout", headers={"Authorization": f"Bearer {old_access_token}"}
    )
    assert logout_resp.status_code == 204

    login_resp = await client.post(
        "/auth/login", json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200

    old_session_resp = await client.get(
        "/users/me", headers={"Authorization": f"Bearer {old_access_token}"}
    )
    assert old_session_resp.status_code == 401


async def test_login_wrong_password(client: AsyncClient):
    email = "wrong@example.com"
    await register_user(client, email, "correct", "Wrong")
    resp = await client.post("/auth/login", json={"email": email, "password": "wrong"})
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.text

async def test_refresh_token(client: AsyncClient):
    email = "refresh@example.com"
    _, refresh_token = await register_user(client, email, "pass", "Refresh")
    resp = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

async def test_refresh_with_invalid_token(client: AsyncClient):
    resp = await client.post("/auth/refresh", json={"refresh_token": "invalid"})
    assert resp.status_code == 401
