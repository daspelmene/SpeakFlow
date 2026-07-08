import pytest
from httpx import AsyncClient
from conftest import register_user

pytestmark = pytest.mark.asyncio


async def setup_matching_users(client: AsyncClient):
    """Create two users with matching languages."""
    token1, _ = await register_user(
        client, "user1@example.com", "pass123", "User One"
    )
    user1_client = AsyncClient(base_url=client.base_url, timeout=10.0)
    user1_client.headers["Authorization"] = f"Bearer {token1}"
    user1_client.access_token = token1
    await user1_client.patch("/users/me", json={
        "native_language": "English",
        "target_language": "Spanish",
    })

    token2, _ = await register_user(
        client, "user2@example.com", "pass456", "User Two"
    )
    user2_client = AsyncClient(base_url=client.base_url, timeout=10.0)
    user2_client.headers["Authorization"] = f"Bearer {token2}"
    user2_client.access_token = token2
    await user2_client.patch("/users/me", json={
        "native_language": "Spanish",
        "target_language": "English",
    })

    return user1_client, user2_client


async def test_create_feedback_room_not_found(auth_client: AsyncClient):
    """Feedback with invalid room_id returns 404."""
    me_resp = await auth_client.get("/users/me")
    current_user_id = me_resp.json()["id"]

    payload = {
        "room_id": "123e4567-e89b-12d3-a456-426614174000",
        "target_user_id": current_user_id,
        "feedback": "Should fail",
    }
    resp = await auth_client.post("/feedback/create", json=payload)
    assert resp.status_code == 404
    assert "Room not found" in resp.json()["detail"]


async def test_create_feedback_target_user_not_found(client: AsyncClient):
    """Feedback with non-existent target user returns 404."""
    user1, user2 = await setup_matching_users(client)

    create_resp = await user1.post("/audio/create-room")
    room_id = create_resp.json()["room_id"]

    payload = {
        "room_id": str(room_id),
        "target_user_id": 99999,
        "feedback": "Should fail",
    }
    resp = await user1.post("/feedback/create", json=payload)
    assert resp.status_code == 404
    assert "Target user not found" in resp.json()["detail"]

    await user1.aclose()
    await user2.aclose()