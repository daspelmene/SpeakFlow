import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_create_feedback_room_not_found(auth_client: AsyncClient):
    """Feedback with invalid room_id returns 404."""
    me_resp = await auth_client.get("/users/me")
    current_user_id = me_resp.json()["id"]

    payload = {
        "room_id": "invalid_room",
        "target_user_id": current_user_id,
        "feedback": "Should fail",
    }
    resp = await auth_client.post("/feedback/create", json=payload)
    assert resp.status_code == 404
    assert "Room not found" in resp.json()["detail"]


async def test_create_feedback_target_user_not_found(auth_client: AsyncClient):
    """Feedback with non-existent target user returns 404."""
    create_resp = await auth_client.post("/audio/create-room")
    room_id = create_resp.json()["roomId"]

    payload = {
        "room_id": room_id,
        "target_user_id": 99999,
        "feedback": "Should fail",
    }
    resp = await auth_client.post("/feedback/create", json=payload)
    assert resp.status_code == 404
    assert "Target user not found" in resp.json()["detail"]
