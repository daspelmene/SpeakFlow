import json
import logging

from fastapi import (
    APIRouter,
    Depends,
    WebSocket,
    WebSocketDisconnect,
    Query,
    HTTPException,
)

from schemas.audio_ws import (
    AvailableRoom,
    AvailableRoomsResponse,
    CreateRoomResponse,
    DisconnectRequest,
)
from utils.audio_ws import ws_audio_service
from utils.jwt import get_current_user
from models.user import User

logger = logging.getLogger("ws-audio-routes")

router = APIRouter(prefix="/audio", tags=["Audio"])


# ------------------------------------------------------------------
# REST endpoints (room management)
# ------------------------------------------------------------------


@router.post("/create-room", response_model=CreateRoomResponse)
async def create_room(user: User = Depends(get_current_user)):
    room_id = ws_audio_service.create_room()
    return CreateRoomResponse(roomId=room_id)


@router.get("/available-rooms", response_model=AvailableRoomsResponse)
async def get_available_rooms(user: User = Depends(get_current_user)):
    rooms = ws_audio_service.get_available_rooms()
    return AvailableRoomsResponse(rooms=[AvailableRoom(**r) for r in rooms])


@router.post("/disconnect")
async def disconnect(
    data: DisconnectRequest,
    user: User = Depends(get_current_user),
):
    await ws_audio_service.disconnect(room_id=data.roomId)
    return {"status": "disconnected"}


# ------------------------------------------------------------------
# WebSocket endpoint (signaling + audio)
# ------------------------------------------------------------------


@router.websocket("/ws/{room_id}")
async def audio_websocket(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(..., description="JWT access token for authentication"),
    user_name: str = Query("", description="Display name"),
):
    """WebSocket endpoint for audio room.

    Handles both:
      - Text frames: signaling messages (JSON)
      - Binary frames: audio data (Opus/WebM chunks)

    Flow:
      1. Client connects with ?token=<jwt>&user_name=<name>
      2. Server authenticates, assigns a slot, sends room-state
      3. Client sends: mute (text), audio (binary)
      4. Server sends: user-joined, user-left, mute, room-state, error (text)
                       + forwards audio binary frames to other participant
    """
    # Authenticate via JWT token
    try:
        from utils.jwt import decode_token

        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token: no subject")
            return
    except HTTPException:
        await websocket.close(code=4001, reason="Authentication failed")
        return
    except Exception as e:
        logger.warning(f"WS auth failed: {e}")
        await websocket.close(code=4001, reason="Authentication failed")
        return

    # Accept the connection AFTER successful auth
    await websocket.accept()

    # Register in room
    try:
        result = await ws_audio_service.ws_connect(
            room_id, str(user_id), user_name, websocket
        )
    except HTTPException as e:
        await websocket.send_json({"type": "error", "message": e.detail})
        await websocket.close(code=4004, reason=e.detail)
        return

    user_slot = result["userSlot"]
    logger.info(f"WS connected: {user_name} as {user_slot} in room {room_id}")

    # Send room state to the newly connected user
    room_info = ws_audio_service.get_room_info(room_id)
    participants = room_info.get("participants", []) if room_info else []
    await websocket.send_json(
        {
            "type": "room-state",
            "roomId": room_id,
            "userSlot": user_slot,
            "userName": result["userName"],
            "participants": participants,
        }
    )
    logger.info(
        f"room-state sent to {user_name}: slot={user_slot}, "
        f"participants={len(participants)}"
    )

    # Message loop — handle BOTH text and binary frames
    try:
        while True:
            message = await websocket.receive()

            # Starlette can return a disconnect message as a regular dict
            # (not just via WebSocketDisconnect exception).
            # Must check before accessing "text"/"bytes" keys.
            if message.get("type") == "websocket.disconnect":
                break

            if "text" in message:
                # Signaling message (JSON)
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    logger.warning(
                        f"Invalid JSON from {user_slot}: {message['text'][:100]}"
                    )
                    continue

                await ws_audio_service.handle_ws_message(room_id, user_slot, data)
                logger.debug(f"WS msg from {user_slot}: type={data.get('type', '?')}")

            elif "bytes" in message:
                # Audio frame (binary) — forward to other participant
                await ws_audio_service.handle_audio_frame(
                    room_id, user_slot, message["bytes"]
                )

    except WebSocketDisconnect:
        logger.info(f"WS disconnected: {user_name} ({user_slot}) from room {room_id}")
    except Exception as e:
        logger.error(f"WS error for {user_slot}: {e}")
    finally:
        await ws_audio_service.disconnect_user(room_id, user_slot)
