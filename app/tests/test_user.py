import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_get_me(auth_client: AsyncClient):
    resp = await auth_client.get("/users/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == auth_client._test_user["email"]
    assert data["fullname"] == auth_client._test_user["fullname"]
    assert "native_language" in data
    assert "target_language" in data

async def test_update_me(auth_client: AsyncClient):
    payload = {
        "fullname": "Updated Name",
        "native_language": "en",
        "target_language": "es",
        "bio": "Test bio",
        "interests": ["music", "travel"],
    }
    resp = await auth_client.patch("/users/me", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    for key, value in payload.items():
        assert data[key] == value

async def test_update_me_empty(auth_client: AsyncClient):
    # send empty update – should return current user without changes
    resp = await auth_client.patch("/users/me", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == auth_client._test_user["email"]

async def test_delete_me(auth_client: AsyncClient, client: AsyncClient):
    resp = await auth_client.delete("/users/me")
    assert resp.status_code == 204
    # after deletion, further requests fail
    resp2 = await auth_client.get("/users/me")
    assert resp2.status_code == 404

# NOT READY YET
# async def test_match_users(auth_client: AsyncClient, second_user_client: AsyncClient):
#     # Set languages for both users
#     for cl, native, target in [
#         (auth_client, "en", "fr"),
#         (second_user_client, "fr", "en"),
#     ]:
#         await cl.patch("/users/me", json={
#             "native_language": native,
#             "target_language": target,
#         })

#     # auth_client should see second_user
#     resp = await auth_client.get("/users/match?limit=10")
#     assert resp.status_code == 200
#     data = resp.json()
#     assert len(data) >= 1
#     assert data[0]["email"] == second_user_client._test_user["email"]

#     # second_user should see auth_client
#     resp2 = await second_user_client.get("/users/match?limit=10")
#     assert resp2.status_code == 200
#     data2 = resp2.json()
#     assert len(data2) >= 1
#     assert data2[0]["email"] == auth_client._test_user["email"]

# async def test_match_limit(auth_client: AsyncClient, second_user_client: AsyncClient):
#     # set compatible languages
#     await auth_client.patch("/users/me", json={"native_language": "en", "target_language": "fr"})
#     await second_user_client.patch("/users/me", json={"native_language": "fr", "target_language": "en"})
#     resp = await auth_client.get("/users/match?limit=1")
#     assert resp.status_code == 200
#     data = resp.json()
#     assert len(data) == 1
