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
    await register_user(client, email, password, "Login")
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

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
