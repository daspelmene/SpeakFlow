import pytest

from app.tests.constants.user import LOGIN_DATA, REGISTER_DATA, UPDATE_DATA

pytestmark = pytest.mark.asyncio


class TestUserFlow:

    async def test_positive_auth_test(self, async_client):
        headers = lambda token: {"Authorization": f"Bearer {token}"}

        # 1. Register
        r = await async_client.post("/api/v1/auth/register", json=REGISTER_DATA)
        assert r.status_code == 200
        tokens = r.json()
        assert "access_token" in tokens

        # 2. Login
        r = await async_client.post("/api/v1/auth/login", json=LOGIN_DATA)
        assert r.status_code == 200
        tokens = r.json()
        access = tokens["access_token"]
        refresh = tokens["refresh_token"]

        # 3. GET /users/me — проверяем ВСЕ поля
        r = await async_client.get("/api/v1/users/me", headers=headers(access))
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == REGISTER_DATA["email"]
        assert body["fullname"] == REGISTER_DATA["fullname"]
        assert body["native_language"] is None
        assert body["target_language"] is None
        assert body["interests"] == []
        assert body["bio"] is None
        assert body["is_active"] is True
        assert "id" in body
        assert "created_at" in body
        assert "updated_at" in body

        # 4. Refresh token
        r = await async_client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert r.status_code == 200
        new_tokens = r.json()
        assert new_tokens["access_token"] != access
        access = new_tokens["access_token"]

        # 5. PATCH /users/me
        r = await async_client.patch("/api/v1/users/me", json=UPDATE_DATA, headers=headers(access))
        assert r.status_code == 200

        # 6. GET /users/me — проверяем изменения
        r = await async_client.get("/api/v1/users/me", headers=headers(access))
        assert r.status_code == 200
        body = r.json()
        assert body["fullname"] == UPDATE_DATA["fullname"]
        assert body["bio"] == UPDATE_DATA["bio"]
        assert body["interests"] == UPDATE_DATA["interests"]
        assert body["email"] == REGISTER_DATA["email"]  # не изменилось

        # 7. Delete
        r = await async_client.delete("/api/v1/users/me", headers=headers(access))
        assert r.status_code == 204
