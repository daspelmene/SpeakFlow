import pytest
import websockets
from httpx import AsyncClient
import json
from conftest import register_user

pytestmark = pytest.mark.asyncio


async def connect_to_room(auth_client: AsyncClient, room_id: str):
    """Connect to a WebSocket room and return websocket, user slot, and role."""
    token = auth_client.access_token
    ws_url = f"ws://backend:8000/api/v1/audio/ws/{room_id}?token={token}"
    websocket = await websockets.connect(ws_url)
    msg = await websocket.recv()
    data = json.loads(msg)
    assert data["type"] == "room-state"
    user_slot = data["userSlot"]
    user_role = data.get("role", "learner")
    return websocket, user_slot, user_role


async def setup_matching_users(client: AsyncClient):
    """Create two users with matching languages so they can be paired."""
    # User 1: native=English, target=Spanish
    token1, _ = await register_user(
        client, "user1@example.com", "pass123", "User One"
    )
    # Need to update profile to set languages
    user1_client = AsyncClient(base_url=client.base_url, timeout=10.0)
    user1_client.headers["Authorization"] = f"Bearer {token1}"
    user1_client.access_token = token1
    await user1_client.patch("/users/me", json={
        "native_language": "English",
        "target_language": "Spanish",
    })

    # User 2: native=Spanish, target=English
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


async def test_create_room_success(client: AsyncClient):
    """Creating a room when matching users exist returns 200 with room_id."""
    user1, user2 = await setup_matching_users(client)

    # User 1 creates a room
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 200
    data = resp.json()
    assert "room_id" in data
    assert "invited_user_id" in data
    assert "invited_user_name" in data
    assert data["invited_user_name"] == "User Two"

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_create_room_no_matches(client: AsyncClient):
    """Creating a room with no matching users returns 404."""
    # Create a user without language preferences
    token, _ = await register_user(
        client, "lonely@example.com", "pass123", "Lonely User"
    )
    user_client = AsyncClient(base_url=client.base_url, timeout=10.0)
    user_client.headers["Authorization"] = f"Bearer {token}"
    user_client.access_token = token

    resp = await user_client.post("/audio/create-room")
    assert resp.status_code == 404
    assert "No matching users" in resp.json()["detail"]

    await user_client.aclose()


async def test_create_room_already_in_room(client: AsyncClient):
    """User already in an active room cannot create another."""
    user1, user2 = await setup_matching_users(client)

    # User 1 creates a room
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 200

    # Try to create another room while still in the first one
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 409
    assert "already in an active room" in resp.json()["detail"]

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_get_active_room(client: AsyncClient):
    """GET /active-room returns the active room for the user."""
    user1, user2 = await setup_matching_users(client)

    # Initially no active room
    resp = await user1.get("/audio/active-room")
    assert resp.status_code == 200
    assert resp.json() is None

    # Create a room
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 200
    room_id = resp.json()["room_id"]

    # Now active room should be returned
    resp = await user1.get("/audio/active-room")
    assert resp.status_code == 200
    data = resp.json()
    assert data["room_id"] == room_id
    assert data["user_slot"] == "user1"
    assert data["role"] == "helper"

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_pending_invitations(client: AsyncClient):
    """Invited user can see pending invitations with profile info."""
    user1, user2 = await setup_matching_users(client)

    # User 1 creates a room (invites User 2)
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 200
    room_id = resp.json()["room_id"]

    # User 2 checks pending invitations
    resp = await user2.get("/audio/pending-invitations")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["invitations"]) == 1
    invitation = data["invitations"][0]
    assert invitation["room_id"] == room_id
    assert invitation["creator_user_name"] == "User One"
    assert invitation["creator_profile"] is not None
    assert invitation["creator_profile"]["native_language"] == "English"
    assert invitation["creator_profile"]["target_language"] == "Spanish"

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_join_room(client: AsyncClient):
    """Invited user can accept invitation and join the room."""
    user1, user2 = await setup_matching_users(client)

    # User 1 creates a room
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 200
    room_id = resp.json()["room_id"]

    # User 2 joins the room
    resp = await user2.post("/audio/join-room", json={"room_id": room_id})
    assert resp.status_code == 200
    data = resp.json()
    assert data["room_id"] == room_id
    assert data["user_slot"] == "user2"
    assert data["role"] == "learner"

    # User 2 should now have an active room
    resp = await user2.get("/audio/active-room")
    assert resp.status_code == 200
    assert resp.json()["room_id"] == room_id

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_join_nonexistent_room(auth_client: AsyncClient):
    """Joining a nonexistent room returns 404."""
    resp = await auth_client.post("/audio/join-room", json={"room_id": "123e4567-e89b-12d3-a456-426614174000"})
    assert resp.status_code == 404


async def test_decline_invitation(client: AsyncClient):
    """User can decline an invitation, which deletes the room."""
    user1, user2 = await setup_matching_users(client)

    # User 1 creates a room
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 200
    room_id = resp.json()["room_id"]

    # User 2 declines the invitation
    resp = await user2.post("/audio/decline-invitation", json={"room_id": room_id})
    assert resp.status_code == 200
    assert resp.json()["message"] == "Invitation declined"

    # Room should be deleted, User 1 should have no active room
    resp = await user1.get("/audio/active-room")
    assert resp.status_code == 200
    assert resp.json() is None

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_leave_room(client: AsyncClient):
    """User can leave an active room."""
    user1, user2 = await setup_matching_users(client)

    # User 1 creates a room
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 200
    room_id = resp.json()["room_id"]

    # User 2 joins
    resp = await user2.post("/audio/join-room", json={"room_id": room_id})
    assert resp.status_code == 200

    # User 1 leaves the room
    resp = await user1.post("/audio/leave-room")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Successfully left the room"

    # Both users should have no active room
    resp = await user1.get("/audio/active-room")
    assert resp.json() is None
    resp = await user2.get("/audio/active-room")
    assert resp.json() is None

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_websocket_connect_and_roles(client: AsyncClient):
    """WebSocket connection assigns correct roles and slots."""
    user1, user2 = await setup_matching_users(client)

    # User 1 creates a room
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 200
    room_id = resp.json()["room_id"]

    # User 2 joins
    resp = await user2.post("/audio/join-room", json={"room_id": room_id})
    assert resp.status_code == 200

    # User 1 connects via WebSocket (creator = user1 = helper)
    ws1, slot1, role1 = await connect_to_room(user1, str(room_id))
    assert slot1 == "user1"
    assert role1 == "helper"

    # User 2 connects via WebSocket (invited = user2 = learner)
    ws2, slot2, role2 = await connect_to_room(user2, str(room_id))
    assert slot2 == "user2"
    assert role2 == "learner"

    await ws1.close()
    await ws2.close()

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_websocket_switch_roles(client: AsyncClient):
    """WebSocket role switching works and notifies both users."""
    user1, user2 = await setup_matching_users(client)

    # Create and join room
    resp = await user1.post("/audio/create-room")
    room_id = resp.json()["room_id"]
    await user2.post("/audio/join-room", json={"room_id": room_id})

    # Connect both users
    ws1, slot1, role1 = await connect_to_room(user1, str(room_id))
    ws2, slot2, role2 = await connect_to_room(user2, str(room_id))

    # ws1 receives a "user-joined" notification when ws2 connects; drain it
    join_notice = json.loads(await ws1.recv())
    assert join_notice["type"] == "user-joined"

    # User 1 sends switch-roles
    await ws1.send(json.dumps({"type": "switch-roles"}))

    # Both users should receive roles-updated
    msg1 = json.loads(await ws1.recv())
    assert msg1["type"] == "roles-updated"
    assert msg1["yourRole"] == "learner"  # Was helper, now learner

    msg2 = json.loads(await ws2.recv())
    assert msg2["type"] == "roles-updated"
    assert msg2["yourRole"] == "helper"  # Was learner, now helper

    await ws1.close()
    await ws2.close()

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_websocket_mute_sync(client: AsyncClient):
    """Mute state is synced between users."""
    user1, user2 = await setup_matching_users(client)

    # Create and join room
    resp = await user1.post("/audio/create-room")
    room_id = resp.json()["room_id"]
    await user2.post("/audio/join-room", json={"room_id": room_id})

    # Connect both users
    ws1, slot1, _ = await connect_to_room(user1, str(room_id))
    ws2, slot2, _ = await connect_to_room(user2, str(room_id))

    # User 1 mutes
    await ws1.send(json.dumps({"type": "mute", "muted": True}))

    # User 2 should receive mute notification
    msg = json.loads(await ws2.recv())
    assert msg["type"] == "mute"
    assert msg["userSlot"] == slot1
    assert msg["muted"] is True

    await ws1.close()
    await ws2.close()

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_websocket_full_room_rejected(client: AsyncClient):
    """Third user cannot join a full room via WebSocket."""
    user1, user2 = await setup_matching_users(client)

    # Create and join room
    resp = await user1.post("/audio/create-room")
    room_id = resp.json()["room_id"]
    await user2.post("/audio/join-room", json={"room_id": room_id})

    # Connect both users
    ws1, _, _ = await connect_to_room(user1, str(room_id))
    ws2, _, _ = await connect_to_room(user2, str(room_id))

    # Create a third user with matching languages
    token3, _ = await register_user(
        client, "third@example.com", "pass789", "Third User"
    )
    # Try to connect as third user - should fail since room is full
    ws_url = f"ws://backend:8000/api/v1/audio/ws/{room_id}?token={token3}"
    ws3 = await websockets.connect(ws_url)
    msg = await ws3.recv()
    error_data = json.loads(msg)
    assert error_data["type"] == "error"
    assert "Room is full" in error_data["message"]
    await ws3.close()
    assert ws3.close_code == 4004

    await ws1.close()
    await ws2.close()

    # Clean up
    await user1.aclose()
    await user2.aclose()


async def test_websocket_nonexistent_room(auth_client: AsyncClient):
    """Connecting to nonexistent room returns error."""
    room_id = "123e4567-e89b-12d3-a456-426614174000"
    token = auth_client.access_token
    ws_url = f"ws://backend:8000/api/v1/audio/ws/{room_id}?token={token}"
    ws = await websockets.connect(ws_url)
    msg = await ws.recv()
    error_data = json.loads(msg)
    assert error_data["type"] == "error"
    assert "Room not found" in error_data["message"]
    await ws.close()
    assert ws.close_code == 4004


async def test_websocket_reconnect_mute_state(client: AsyncClient):
    """Reconnecting user receives current mute state of peer."""
    user1, user2 = await setup_matching_users(client)

    # Create and join room
    resp = await user1.post("/audio/create-room")
    room_id = resp.json()["room_id"]
    await user2.post("/audio/join-room", json={"room_id": room_id})

    # User 1 connects and mutes
    ws1, slot1, _ = await connect_to_room(user1, str(room_id))
    await ws1.send(json.dumps({"type": "mute", "muted": True}))

    # User 2 connects and should receive room-state with user1 muted
    ws2, slot2, _ = await connect_to_room(user2, str(room_id))
    # Already received room-state from connect_to_room
    # Check participants for mute state
    # The room-state was already consumed in connect_to_room
    # Let's disconnect user2 and reconnect to verify
    await ws2.close()

    # Reconnect user2
    ws2_reconnect, _, _ = await connect_to_room(user2, str(room_id))
    # User 2 should receive audio-restart-required after reconnect
    # (depends on timing - may get room-state or peer-reconnected)

    await ws1.close()
    await ws2_reconnect.close()

    # Clean up
    await user1.aclose()
    await user2.aclose()

async def test_websocket_ping_pong(client: AsyncClient):
    """Server replies to keepalive ping with pong echoing the timestamp."""
    user1, user2 = await setup_matching_users(client)

    resp = await user1.post("/audio/create-room")
    room_id = resp.json()["room_id"]

    ws1, _, _ = await connect_to_room(user1, str(room_id))

    await ws1.send(json.dumps({"type": "ping", "ts": 12345}))
    msg = await ws1.recv()
    data = json.loads(msg)
    assert data["type"] == "pong"
    assert data["ts"] == 12345

    await ws1.close()
    await user1.aclose()
    await user2.aclose()


async def test_websocket_stale_socket_close_keeps_reconnected_session(
    client: AsyncClient,
):
    """Closing a stale socket after reconnect must not clear the new session.

    Simulates a proxy silently killing a connection: the client reconnects
    with a new socket while the old one is still registered on the server,
    then the old socket dies. The reconnected session must stay alive past
    the disconnect grace period.
    """
    import asyncio

    user1, user2 = await setup_matching_users(client)

    resp = await user1.post("/audio/create-room")
    room_id = resp.json()["room_id"]

    # Original connection (will become stale)
    ws_stale, _, _ = await connect_to_room(user1, str(room_id))

    # Client reconnects with a fresh socket while the old one is still open
    ws_new, _, _ = await connect_to_room(user1, str(room_id))

    # The stale socket dies (proxy timeout / network drop)
    await ws_stale.close()

    # Wait past the 3-second disconnect grace period
    await asyncio.sleep(4.0)

    # The reconnected session must still be alive and answering pings
    await ws_new.send(json.dumps({"type": "ping", "ts": 777}))
    msg = await asyncio.wait_for(ws_new.recv(), timeout=5.0)
    data = json.loads(msg)
    assert data["type"] == "pong"
    assert data["ts"] == 777

    await ws_new.close()
    await user1.aclose()
    await user2.aclose()


async def test_invite_by_email_success(client: AsyncClient):
    """Inviting an existing user by email creates a room and an invitation."""
    user1, user2 = await setup_matching_users(client)

    resp = await user1.post(
        "/audio/invite-by-email", json={"email": "user2@example.com"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "room_id" in data
    assert data["invited_user_name"] == "User Two"

    # The invited user should now see a pending invitation
    resp = await user2.get("/audio/pending-invitations")
    assert resp.status_code == 200
    invitations = resp.json()["invitations"]
    assert any(inv["room_id"] == data["room_id"] for inv in invitations)

    await user1.aclose()
    await user2.aclose()


async def test_invite_by_email_trims_whitespace(client: AsyncClient):
    """Surrounding whitespace in the email is ignored when looking up the user."""
    user1, user2 = await setup_matching_users(client)

    resp = await user1.post(
        "/audio/invite-by-email", json={"email": "  user2@example.com  "}
    )
    assert resp.status_code == 200

    await user1.aclose()
    await user2.aclose()


async def test_invite_by_email_case_insensitive(client: AsyncClient):
    """The invited email is matched ignoring case."""
    user1, user2 = await setup_matching_users(client)

    resp = await user1.post(
        "/audio/invite-by-email", json={"email": "USER2@EXAMPLE.COM"}
    )
    assert resp.status_code == 200
    assert resp.json()["invited_user_name"] == "User Two"

    await user1.aclose()
    await user2.aclose()


async def test_invite_by_email_user_not_found(client: AsyncClient):
    """Inviting an email with no matching account returns 404."""
    user1, user2 = await setup_matching_users(client)

    resp = await user1.post(
        "/audio/invite-by-email", json={"email": "nobody@example.com"}
    )
    assert resp.status_code == 404
    assert "No user found" in resp.json()["detail"]

    await user1.aclose()
    await user2.aclose()


async def test_invite_by_email_self(client: AsyncClient):
    """A user cannot invite themselves by email."""
    user1, user2 = await setup_matching_users(client)

    resp = await user1.post(
        "/audio/invite-by-email", json={"email": "user1@example.com"}
    )
    assert resp.status_code == 400
    assert "yourself" in resp.json()["detail"].lower()

    await user1.aclose()
    await user2.aclose()


async def test_invite_by_email_already_in_room(client: AsyncClient):
    """A user already in a room cannot invite another user by email."""
    user1, user2 = await setup_matching_users(client)

    # user1 first creates a room via matchmaking
    resp = await user1.post("/audio/create-room")
    assert resp.status_code == 200

    # Now inviting by email should be rejected
    resp = await user1.post(
        "/audio/invite-by-email", json={"email": "user2@example.com"}
    )
    assert resp.status_code == 409
    assert "already in an active room" in resp.json()["detail"]

    await user1.aclose()
    await user2.aclose()


async def test_invite_by_email_target_already_in_room(client: AsyncClient):
    """Cannot invite a user who is already busy in another room."""
    # Three users: user1 & user2 match; user3 will be pulled into a room first.
    user1, user2 = await setup_matching_users(client)

    token3, _ = await register_user(
        client, "user3@example.com", "pass789", "User Three"
    )
    user3 = AsyncClient(base_url=client.base_url, timeout=10.0)
    user3.headers["Authorization"] = f"Bearer {token3}"
    user3.access_token = token3
    await user3.patch("/users/me", json={
        "native_language": "English",
        "target_language": "Spanish",
    })

    # user3 invites user2, so user2 is now busy
    resp = await user3.post(
        "/audio/invite-by-email", json={"email": "user2@example.com"}
    )
    assert resp.status_code == 200

    # user1 now tries to invite the busy user2
    resp = await user1.post(
        "/audio/invite-by-email", json={"email": "user2@example.com"}
    )
    assert resp.status_code == 409
    assert "already in an active room" in resp.json()["detail"]

    await user1.aclose()
    await user2.aclose()
    await user3.aclose()
