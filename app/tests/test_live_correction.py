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


async def test_create_note_room_not_found(auth_client: AsyncClient):
    """Creating a note with an invalid room_id returns 404."""
    me_resp = await auth_client.get("/users/me")
    current_user_id = me_resp.json()["id"]

    payload = {
        "room_id": "123e4567-e89b-12d3-a456-426614174000",
        "target_user_id": current_user_id,
        "note_text": "Should fail",
    }
    resp = await auth_client.post("/notes/create", json=payload)
    assert resp.status_code == 404
    assert "Room not found" in resp.json()["detail"]


async def test_create_note_target_user_not_found(client: AsyncClient):
    """Creating a note with a non-existent target user returns 404."""
    user1, user2 = await setup_matching_users(client)

    # Create a room first
    create_resp = await user1.post("/audio/create-room")
    room_id = create_resp.json()["room_id"]

    payload = {
        "room_id": str(room_id),
        "target_user_id": 99999,  # non-existent user
        "note_text": "Should fail",
    }
    resp = await user1.post("/notes/create", json=payload)
    assert resp.status_code == 404
    assert "Target user not found" in resp.json()["detail"]

    await user1.aclose()
    await user2.aclose()


async def test_get_notes_returns_only_targeted_notes(client: AsyncClient):
    """GET /notes returns notes where target_user_id == current user."""
    user1, user2 = await setup_matching_users(client)

    # Create a room
    create_resp = await user1.post("/audio/create-room")
    room_id = create_resp.json()["room_id"]

    # User 2 joins the room
    await user2.post("/audio/join-room", json={"room_id": room_id})

    # Get current user ids
    me_resp = await user1.get("/users/me")
    current_user_id = me_resp.json()["id"]

    second_user_resp = await user2.get("/users/me")
    second_user_id = second_user_resp.json()["id"]

    # Create a note targeting user1 (current user)
    payload = {
        "room_id": str(room_id),
        "target_user_id": current_user_id,
        "note_text": "Note for me",
    }
    await user2.post("/notes/create", json=payload)

    # Create another note targeting user2
    payload2 = {
        "room_id": str(room_id),
        "target_user_id": second_user_id,
        "note_text": "Note for second user",
    }
    await user1.post("/notes/create", json=payload2)

    # GET notes for user1 – should only see notes targeting them
    resp = await user1.get("/notes")
    notes = resp.json()
    assert all(n["target_user_id"] == current_user_id for n in notes)

    await user1.aclose()
    await user2.aclose()