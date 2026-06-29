import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def create_and_join(client: AsyncClient, user_name: str = "Tester"):
    create_resp = await client.post("/audio/create-room")
    room_id = create_resp.json()["roomId"]
    join_resp = await client.post("/audio/join", json={
        "roomId": room_id,
        "userName": user_name,
    })
    join_data = join_resp.json()
    return room_id, join_data["userSlot"]

async def test_create_room(auth_client: AsyncClient):
    resp = await auth_client.post("/audio/create-room")
    assert resp.status_code == 200
    data = resp.json()
    assert "roomId" in data
    assert len(data["roomId"]) == 8

async def test_join_room(auth_client: AsyncClient):
    room_id = (await auth_client.post("/audio/create-room")).json()["roomId"]
    resp = await auth_client.post("/audio/join", json={
        "roomId": room_id,
        "userName": "Joiner",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "joined"
    assert data["roomId"] == room_id
    assert "userSlot" in data
    # Бэкенд возвращает имя из токена, а не из запроса
    assert data["userName"] == auth_client._test_user["fullname"]

async def test_join_full_room(auth_client: AsyncClient, second_user_client: AsyncClient):
    room_id = (await auth_client.post("/audio/create-room")).json()["roomId"]
    await auth_client.post("/audio/join", json={"roomId": room_id, "userName": "User1"})
    await second_user_client.post("/audio/join", json={"roomId": room_id, "userName": "User2"})
    resp = await second_user_client.post("/audio/join", json={"roomId": room_id, "userName": "User3"})
    assert resp.status_code == 400
    assert "Room is full" in resp.text

async def test_join_nonexistent_room(auth_client: AsyncClient):
    resp = await auth_client.post("/audio/join", json={
        "roomId": "nonexistent",
        "userName": "Ghost",
    })
    assert resp.status_code == 404
    assert "Room not found" in resp.text

async def test_available_rooms(auth_client: AsyncClient):
    room_id, _ = await create_and_join(auth_client)
    resp = await auth_client.get("/audio/available-rooms")
    assert resp.status_code == 200
    data = resp.json()
    rooms = data["rooms"]
    assert any(r["roomId"] == room_id for r in rooms)

async def test_disconnect(auth_client: AsyncClient):
    room_id, _ = await create_and_join(auth_client)
    resp = await auth_client.post("/audio/disconnect", json={"roomId": room_id})
    assert resp.status_code == 200
    assert resp.json()["status"] == "disconnected"
    avail = await auth_client.get("/audio/available-rooms")
    rooms = avail.json()["rooms"]
    assert all(r["roomId"] != room_id for r in rooms)

async def test_should_renegotiate(auth_client: AsyncClient):
    room_id, user_slot = await create_and_join(auth_client)
    resp = await auth_client.get(f"/audio/should-renegotiate?roomId={room_id}&userSlot={user_slot}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["renegotiate"] is False

async def test_offer_sdp(auth_client: AsyncClient):
    room_id, user_slot = await create_and_join(auth_client)
    dummy_sdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"
    resp = await auth_client.post("/audio/offer", json={
        "roomId": room_id,
        "userSlot": user_slot,
        "sdp": dummy_sdp,
        "type": "offer",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "sdp" in data
    assert data["type"] == "answer"

async def test_offer_unknown_room(auth_client: AsyncClient):
    dummy_sdp = "v=0\r\no=- 0 0\r\n"
    resp = await auth_client.post("/audio/offer", json={
        "roomId": "unknown",
        "userSlot": "user1",
        "sdp": dummy_sdp,
        "type": "offer",
    })
    assert resp.status_code == 404
    assert "Room not found" in resp.text

async def test_ice_candidate(auth_client: AsyncClient):
    room_id, user_slot = await create_and_join(auth_client)
    candidate_payload = {
        "roomId": room_id,
        "userSlot": user_slot,
        "candidate": {
            "candidate": "candidate:1 1 UDP 2122252543 192.168.1.1 5000 typ host",
            "sdpMid": "0",
            "sdpMLineIndex": 0,
        }
    }
    resp = await auth_client.post("/audio/ice-candidate", json=candidate_payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

async def test_ice_candidate_missing_fields(auth_client: AsyncClient):
    room_id, user_slot = await create_and_join(auth_client)
    # Отсутствует обязательное поле candidate -> валидация Pydantic вернёт 422
    resp = await auth_client.post("/audio/ice-candidate", json={
        "roomId": room_id,
        "userSlot": user_slot,
        "candidate": {"sdpMid": "0"}   # нет поля "candidate"
    })
    # Теперь ожидаем 422, так как валидация не пройдена
    assert resp.status_code == 422
