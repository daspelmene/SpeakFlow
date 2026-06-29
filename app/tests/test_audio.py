import pytest
import websockets
from httpx import AsyncClient
import json
from conftest import register_user

pytestmark = pytest.mark.asyncio

async def connect_to_room(auth_client: AsyncClient, room_id: str, user_name: str = "Tester"):
    token = auth_client.access_token
    ws_url = f"ws://backend:8000/api/v1/audio/ws/{room_id}?token={token}&user_name={user_name}"
    websocket = await websockets.connect(ws_url)
    msg = await websocket.recv()
    data = json.loads(msg)
    assert data["type"] == "room-state"
    user_slot = data["userSlot"]
    return websocket, user_slot

async def test_create_room(auth_client: AsyncClient):
    resp = await auth_client.post("/audio/create-room")
    assert resp.status_code == 200
    data = resp.json()
    assert "roomId" in data
    assert len(data["roomId"]) == 8

async def test_join_room(auth_client: AsyncClient):
    create_resp = await auth_client.post("/audio/create-room")
    room_id = create_resp.json()["roomId"]
    ws, slot = await connect_to_room(auth_client, room_id)
    assert slot in ("user1", "user2")
    await ws.close()

async def test_join_full_room(auth_client: AsyncClient, second_user_client: AsyncClient, client: AsyncClient):
    create_resp = await auth_client.post("/audio/create-room")
    room_id = create_resp.json()["roomId"]

    ws1, slot1 = await connect_to_room(auth_client, room_id, "User1")
    assert slot1 == "user1"

    ws2, slot2 = await connect_to_room(second_user_client, room_id, "User2")
    assert slot2 == "user2"

    email3 = "third@example.com"
    password3 = "pass789"
    fullname3 = "Third User"
    token3, _ = await register_user(client, email3, password3, fullname3)

    ws_url = f"ws://backend:8000/api/v1/audio/ws/{room_id}?token={token3}&user_name=User3"
    ws3 = await websockets.connect(ws_url)
    msg = await ws3.recv()
    error_data = json.loads(msg)
    assert error_data["type"] == "error"
    assert "Room is full" in error_data["message"]
    await ws3.close()
    assert ws3.close_code == 4004

    await ws1.close()
    await ws2.close()

async def test_join_nonexistent_room(auth_client: AsyncClient):
    room_id = "nonexistent"
    token = auth_client.access_token
    ws_url = f"ws://backend:8000/api/v1/audio/ws/{room_id}?token={token}&user_name=Ghost"
    ws = await websockets.connect(ws_url)
    msg = await ws.recv()
    error_data = json.loads(msg)
    assert error_data["type"] == "error"
    assert "Room not found" in error_data["message"]
    await ws.close()
    assert ws.close_code == 4004

async def test_available_rooms(auth_client: AsyncClient):
    create_resp = await auth_client.post("/audio/create-room")
    room_id = create_resp.json()["roomId"]

    resp = await auth_client.get("/audio/available-rooms")
    assert resp.status_code == 200
    rooms = resp.json()["rooms"]
    assert all(r["roomId"] != room_id for r in rooms)

    ws, _ = await connect_to_room(auth_client, room_id)

    resp = await auth_client.get("/audio/available-rooms")
    assert resp.status_code == 200
    rooms = resp.json()["rooms"]
    assert any(r["roomId"] == room_id for r in rooms)

    disconnect_resp = await auth_client.post("/audio/disconnect", json={"roomId": room_id})
    assert disconnect_resp.status_code == 200
    assert disconnect_resp.json()["status"] == "disconnected"

    resp = await auth_client.get("/audio/available-rooms")
    assert resp.status_code == 200
    rooms = resp.json()["rooms"]
    assert all(r["roomId"] != room_id for r in rooms)

    await ws.close()

async def test_disconnect(auth_client: AsyncClient):
    create_resp = await auth_client.post("/audio/create-room")
    room_id = create_resp.json()["roomId"]

    ws, _ = await connect_to_room(auth_client, room_id)

    resp = await auth_client.get("/audio/available-rooms")
    assert resp.status_code == 200
    rooms = resp.json()["rooms"]
    assert any(r["roomId"] == room_id for r in rooms)

    disconnect_resp = await auth_client.post("/audio/disconnect", json={"roomId": room_id})
    assert disconnect_resp.status_code == 200
    assert disconnect_resp.json()["status"] == "disconnected"

    resp = await auth_client.get("/audio/available-rooms")
    assert resp.status_code == 200
    rooms = resp.json()["rooms"]
    assert all(r["roomId"] != room_id for r in rooms)

    await ws.close()
