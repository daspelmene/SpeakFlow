import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


async def test_create_note_room_not_found(auth_client: AsyncClient):
    """Creating a note with an invalid room_id returns 404."""
    me_resp = await auth_client.get("/users/me")
    current_user_id = me_resp.json()["id"]

    payload = {
        "room_id": "invalid_room",
        "target_user_id": current_user_id,
        "note_text": "Should fail",
    }
    resp = await auth_client.post("/notes/create", json=payload)
    assert resp.status_code == 404
    assert "Room not found" in resp.json()["detail"]


async def test_create_note_target_user_not_found(auth_client: AsyncClient):
    """Creating a note with a non-existent target user returns 404."""
    # Create a room first
    create_resp = await auth_client.post("/audio/create-room")
    room_id = create_resp.json()["roomId"]

    payload = {
        "room_id": room_id,
        "target_user_id": 99999,  # non-existent user
        "note_text": "Should fail",
    }
    resp = await auth_client.post("/notes/create", json=payload)
    assert resp.status_code == 404
    assert "Target user not found" in resp.json()["detail"]


async def test_get_notes_returns_only_targeted_notes(auth_client: AsyncClient, second_user_client: AsyncClient):
    """GET /notes returns notes where target_user_id == current user."""
    # Create a room
    create_resp = await auth_client.post("/audio/create-room")
    room_id = create_resp.json()["roomId"]

    # Get current user id
    me_resp = await auth_client.get("/users/me")
    current_user_id = me_resp.json()["id"]

    # Create a note targeting current user
    payload = {
        "room_id": room_id,
        "target_user_id": current_user_id,
        "note_text": "Note for me",
    }
    await auth_client.post("/notes/create", json=payload)

    # Create another note targeting the second user (different target)
    second_user_id = (await second_user_client.get("/users/me")).json()["id"]
    payload2 = {
        "room_id": room_id,
        "target_user_id": second_user_id,
        "note_text": "Note for second user",
    }
    await auth_client.post("/notes/create", json=payload2)

    # GET notes for first user – should only see the first note
    resp = await auth_client.get("/notes")
    notes = resp.json()
    assert all(n["target_user_id"] == current_user_id for n in notes)
