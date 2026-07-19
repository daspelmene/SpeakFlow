import json
import logging

from fastapi import (
    APIRouter,
    Depends,
    WebSocket,
    WebSocketDisconnect,
    Query,
    HTTPException,
    status,
)

from schemas.room import (
    RoomCreateResponse,
    RoomInvitation,
    RoomInvitationsResponse,
    RoomInviteByEmailRequest,
    RoomJoinRequest,
    RoomJoinResponse,
    MessageResponse,
    ActiveRoomResponse,
    UserProfileSummary,
)
from uuid import UUID
from utils.audio_ws import ws_audio_service
from utils.jwt import get_current_user, decode_token
from models.user import User
from storage.database import Database
from services.llm.partner_matching_service import rank_matching_users

logger = logging.getLogger("audio-routes")

router = APIRouter(prefix="/audio", tags=["Audio"])


def _build_user_profile(user: User) -> UserProfileSummary:
    """Build a profile summary from a User model."""
    return UserProfileSummary(
        user_id=user.id,
        fullname=user.fullname,
        native_language=user.native_language,
        target_language=user.target_language,
        interests=user.interests or [],
        bio=user.bio,
    )


# ------------------------------------------------------------------
# REST endpoints - Room matching & management
# ------------------------------------------------------------------


@router.get("/active-room", response_model=ActiveRoomResponse | None)
async def get_active_room(
    user: User = Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    """Get the current active room for the user, if any."""
    logger.info(f"User {user.id} ({user.fullname}) checking active room")

    room = await db.rooms.get_active_room_for_user(user.id)
    if room is None:
        logger.info(f"No active room for user {user.id}")
        return None

    room_id_str = str(room.room_id)
    logger.info(f"Found active room {room_id_str} for user {user.id}")

    # Determine user slot and role
    if room.user_creator_id == user.id:
        user_slot = "user1"
    else:
        user_slot = "user2"

    # Get role from WebSocket service if available, otherwise default
    role = "helper" if user_slot == "user1" else "learner"
    if room_id_str in ws_audio_service.rooms:
        ws_room = ws_audio_service.rooms[room_id_str]
        role = ws_room.get("roles", {}).get(user_slot, role)

    return ActiveRoomResponse(
        room_id=room.room_id,
        user_slot=user_slot,
        role=role,
    )


@router.post("/create-room", response_model=RoomCreateResponse)
async def create_room(
    user: User = Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    """Create a room and invite a matched user."""
    logger.info(f"User {user.id} ({user.fullname}) is looking for a match")

    # Check if user is already in a room
    existing_room = await db.rooms.get_active_room_for_user(user.id)
    if existing_room:
        logger.warning(f"User {user.id} already in room {existing_room.room_id}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already in an active room",
        )

    # Find matched users
    matched_users = await db.users.get_matched_users(user)
    logger.info(f"Found {len(matched_users)} matched users for user {user.id}")

    # Filter out users already in rooms
    available_matched = []
    for matched_user in matched_users:
        in_room = await db.rooms.is_user_in_any_room(matched_user.id)
        if not in_room:
            available_matched.append(matched_user)
        else:
            logger.debug(
                f"Skipping user {matched_user.id} ({matched_user.fullname}) - already in a room"
            )

    logger.info(
        f"Available matched users after filtering: {len(available_matched)}"
    )

    available_matched = await rank_matching_users(user, available_matched)

    if not available_matched:
        logger.warning(f"No available matched users for user {user.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching users available right now. Please try again later.",
        )

    # Pick the first available matched user
    invited_user = available_matched[0]
    logger.info(
        f"Inviting user {invited_user.id} ({invited_user.fullname}) to room"
    )

    # Create room in database
    room = await db.rooms.create_room(
        user_creator_id=user.id,
        invited_user_id=invited_user.id,
    )

    logger.info(
        f"Room {room.room_id} created in database: "
        f"creator={user.id} ({user.fullname}), "
        f"invited={invited_user.id} ({invited_user.fullname})"
    )

    # Register room in WebSocket service
    ws_audio_service.register_room(
        str(room.room_id),
        user.fullname,
        invited_user.fullname,
        creator_user_id=user.id,
        invited_user_id=invited_user.id,
    )
    logger.info(f"Room {room.room_id} registered in WebSocket service")

    return RoomCreateResponse(
        room_id=room.room_id,
        invited_user_id=invited_user.id,
        invited_user_name=invited_user.fullname,
    )


@router.post("/invite-by-email", response_model=RoomCreateResponse)
async def invite_by_email(
    data: RoomInviteByEmailRequest,
    user: User = Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    """Create a room and invite a specific user by email."""
    email = data.email.strip()
    logger.info(f"User {user.id} ({user.fullname}) inviting {email} by email")

    # Check if the inviting user is already in a room
    existing_room = await db.rooms.get_active_room_for_user(user.id)
    if existing_room:
        logger.warning(f"User {user.id} already in room {existing_room.room_id}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already in an active room",
        )

    # Look up the invited user by email (case-insensitive, so a user who
    # registered as "Bob@X.com" can still be invited as "bob@x.com")
    invited_user = await db.users.get_user_by_email_insensitive(email)
    if invited_user is None:
        logger.warning(f"No user found with email {email}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found with this email",
        )

    if invited_user.id == user.id:
        logger.warning(f"User {user.id} tried to invite themselves")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot invite yourself",
        )

    # Make sure the invited user is not already busy in another room
    invited_in_room = await db.rooms.is_user_in_any_room(invited_user.id)
    if invited_in_room:
        logger.warning(
            f"Invited user {invited_user.id} ({invited_user.fullname}) "
            f"is already in a room"
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This user is already in an active room",
        )

    # Create room in database
    room = await db.rooms.create_room(
        user_creator_id=user.id,
        invited_user_id=invited_user.id,
    )

    logger.info(
        f"Room {room.room_id} created by email invite: "
        f"creator={user.id} ({user.fullname}), "
        f"invited={invited_user.id} ({invited_user.fullname})"
    )

    # Register room in WebSocket service
    ws_audio_service.register_room(
        str(room.room_id),
        user.fullname,
        invited_user.fullname,
        creator_user_id=user.id,
        invited_user_id=invited_user.id,
    )
    logger.info(f"Room {room.room_id} registered in WebSocket service")

    return RoomCreateResponse(
        room_id=room.room_id,
        invited_user_id=invited_user.id,
        invited_user_name=invited_user.fullname,
    )


@router.get("/pending-invitations", response_model=RoomInvitationsResponse)
async def get_pending_invitations(
    user: User = Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    """Get all pending room invitations for the current user."""
    logger.info(f"Fetching pending invitations for user {user.id} ({user.fullname})")

    rooms = await db.rooms.get_pending_invitations(user.id)
    logger.info(f"Found {len(rooms)} pending invitations for user {user.id}")

    invitations = []
    for room in rooms:
        # Get creator info with full profile
        creator = await db.users.get_user_by_id(room.user_creator_id)
        if creator:
            invitations.append(
                RoomInvitation(
                    room_id=room.room_id,
                    creator_user_id=creator.id,
                    creator_user_name=creator.fullname,
                    creator_profile=_build_user_profile(creator),
                )
            )
            logger.debug(
                f"Invitation: room={room.room_id}, creator={creator.fullname}"
            )
        else:
            logger.warning(
                f"Creator user {room.user_creator_id} not found for room {room.room_id}"
            )

    return RoomInvitationsResponse(invitations=invitations)


@router.post("/join-room", response_model=RoomJoinResponse)
async def join_room(
    data: RoomJoinRequest,
    user: User = Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    """Accept an invitation and join the room."""
    logger.info(
        f"User {user.id} ({user.fullname}) attempting to join room {data.room_id}"
    )

    # Accept the invitation in database
    room = await db.rooms.accept_invitation(data.room_id, user.id)
    if room is None:
        logger.warning(
            f"Room {data.room_id} not found or user {user.id} not invited"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found or you are not invited to this room",
        )
    room_str = str(room.room_id)
    logger.info(
        f"User {user.id} ({user.fullname}) successfully joined room {data.room_id} "
        f"as user2 (invited)"
    )

    # Ensure room is registered in WebSocket service
    # (should already be from create-room, but let's be safe)
    if room_str not in ws_audio_service.rooms:
        logger.info(f"Room {room_str} not in WebSocket service, registering now")

        creator = await db.users.get_user_by_id(room.user_creator_id)
        creator_name = creator.fullname if creator else "Creator"

        ws_audio_service.register_room(
            room_str,
            creator_name,
            user.fullname,
            creator_user_id=room.user_creator_id,
            invited_user_id=room.invited_user_id,
        )

    # Get role for invited user (default: learner)
    role = "learner"
    if room_str in ws_audio_service.rooms:
        role = ws_audio_service.rooms[room_str].get("roles", {}).get("user2", "learner")

    return RoomJoinResponse(
        room_id=room.room_id,
        user_slot="user2",
        role=role,
    )


@router.post("/leave-room", response_model=MessageResponse)
async def leave_room(
    user: User = Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    """Leave the current room."""
    logger.info(f"User {user.id} ({user.fullname}) requesting to leave room")

    room = await db.rooms.get_active_room_for_user(user.id)
    if room is None:
        logger.warning(f"User {user.id} is not in any active room")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not in any active room",
        )

    room_id_str = str(room.room_id)
    logger.info(
        f"User {user.id} ({user.fullname}) leaving room {room_id_str} "
        f"(creator={room.user_creator_id}, invited={room.invited_user_id})"
    )

    # Clean up WebSocket connections first
    await ws_audio_service.cleanup_room(room_id_str)
    logger.info(f"WebSocket connections cleaned up for room {room_id_str}")

    # Delete the room from database
    finished = await db.rooms.finish_room(room.room_id)
    if finished:
        logger.info(f"Room {room_id_str} marked as finished")
    else:
        logger.warning(f"Failed to mark room {room_id_str} as finished")

    await ws_audio_service.end_room(
        room_id_str,
        reason="One participant left the room",
    )

    return MessageResponse(message="Successfully left the room")


@router.post("/decline-invitation", response_model=MessageResponse)
async def decline_invitation(
    data: RoomJoinRequest,
    user: User = Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    """Decline a room invitation."""
    logger.info(
        f"User {user.id} ({user.fullname}) declining invitation for room {data.room_id}"
    )

    room = await db.rooms.get_room_by_id(data.room_id)
    if room is None:
        logger.warning(f"Room {data.room_id} not found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    if room.invited_user_id != user.id:
        logger.warning(
            f"User {user.id} tried to decline invitation for room {data.room_id} "
            f"but is not the invited user (invited={room.invited_user_id})"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not invited to this room",
        )

    room_id_str = str(room.room_id)
    logger.info(
        f"User {user.id} declined invitation for room {room_id_str}"
    )

    # Clean up WebSocket connections if any
    if room_id_str in ws_audio_service.rooms:
        await ws_audio_service.cleanup_room(room_id_str)
        logger.info(f"WebSocket connections cleaned up for declined room {room_id_str}")

    # Delete the room from database
    deleted = await db.rooms.delete_room(data.room_id)
    if deleted:
        logger.info(f"Room {room_id_str} deleted from database after decline")
    else:
        logger.warning(f"Failed to delete room {room_id_str} from database")

    return MessageResponse(message="Invitation declined")


# ------------------------------------------------------------------
# WebSocket endpoint (signaling + audio)
# ------------------------------------------------------------------


@router.websocket("/ws/{room_id}")
async def audio_websocket(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(..., description="JWT access token for authentication"),
    db: Database = Depends(Database.get_db),
):
    logger.info(f"WebSocket connection attempt for room {room_id}")

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")

        if not user_id or payload.get("type") != "access":
            logger.warning("WebSocket auth failed: no subject in token")
            await websocket.close(code=4001, reason="Invalid token: no subject")
            return

        user_id = int(user_id)
        user = await db.users.get_user_by_id(user_id)
        if user is None or payload.get("sid") != user.active_session_id:
            await websocket.close(code=4001, reason="Session is no longer active")
            return

        logger.info(f"WebSocket authenticated for user {user_id} in room {room_id}")
    except HTTPException:
        logger.warning("WebSocket auth failed: HTTPException during token decode")
        await websocket.close(code=4001, reason="Authentication failed")
        return
    except Exception as error:
        logger.warning(f"WebSocket auth failed: {error}")
        await websocket.close(code=4001, reason="Authentication failed")
        return

    await websocket.accept()

    logger.info(f"WebSocket accepted for user {user_id} in room {room_id}")

    try:
        room_uuid = UUID(room_id)
    except ValueError:
        await websocket.send_json({"type": "error", "message": "Invalid room id"})
        await websocket.close(code=4004, reason="Invalid room id")
        return

    room = await db.rooms.get_room_by_id(room_uuid)

    if room is None or room.is_finished:
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close(code=4004, reason="Room not found")
        return

    if not room.is_invited_accepted and user_id != room.user_creator_id:
        await websocket.send_json({"type": "error", "message": "Room is not active"})
        await websocket.close(code=4003, reason="Room is not active")
        return

    if user_id not in (room.user_creator_id, room.invited_user_id):
        ws_room = ws_audio_service.rooms.get(room_id)

        if ws_room and ws_room.get("user1") is not None and ws_room.get("user2") is not None:
            await websocket.send_json({"type": "error", "message": "Room is full"})
            await websocket.close(code=4004, reason="Room is full")
            return

        await websocket.send_json(
            {"type": "error", "message": "Not a participant of this room"}
        )
        await websocket.close(code=4003, reason="Not a participant of this room")
        return

    is_participant = user_id in (room.user_creator_id, room.invited_user_id)

    if not is_participant:
        ws_room = ws_audio_service.rooms.get(room_id)

        if ws_room and ws_room.get("user1") and ws_room.get("user2"):
            await websocket.send_json({"type": "error", "message": "Room is full"})
            await websocket.close(code=4004, reason="Room is full")
            return

        await websocket.send_json(
            {"type": "error", "message": "Not a participant of this room"}
        )
        await websocket.close(code=4003, reason="Not a participant of this room")
        return

    if room_id not in ws_audio_service.rooms:
        creator = await db.users.get_user_by_id(room.user_creator_id)
        invited = await db.users.get_user_by_id(room.invited_user_id)

        ws_audio_service.register_room(
            room_id,
            creator.fullname if creator else "Creator",
            invited.fullname if invited else "Invited",
            creator_user_id=room.user_creator_id,
            invited_user_id=room.invited_user_id,
        )

        logger.info(f"Restored WebSocket room {room_id} from database")

    try:
        result = await ws_audio_service.ws_connect(
            room_id,
            str(user_id),
            websocket,
        )
    except HTTPException as error:
        logger.warning(f"WebSocket connection rejected: {error.detail}")
        await websocket.send_json({"type": "error", "message": error.detail})
        await websocket.close(code=4004, reason=error.detail)
        return
    except Exception as error:
        logger.error(f"WebSocket connection error: {error}")
        await websocket.close(code=4000, reason="Internal error")
        return

    user_slot = result["userSlot"]
    user_name = result["userName"]
    user_role = result.get("role", "learner")
    is_reconnect = result.get("status") == "reconnected"

    logger.info(
        f"WebSocket connected: user={user_name} (id={user_id}) "
        f"as {user_slot} ({user_role}) in room {room_id} "
        f"(reconnect={is_reconnect})"
    )

    if not is_reconnect:
        room_info = ws_audio_service.get_room_info(room_id)
        participants = room_info.get("participants", []) if room_info else []
        roles = room_info.get("roles", {}) if room_info else {}

        await websocket.send_json(
            {
                "type": "room-state",
                "roomId": room_id,
                "userSlot": user_slot,
                "userName": user_name,
                "role": user_role,
                "roles": roles,
                "participants": participants,
            }
        )

        logger.info(
            f"room-state sent to {user_name}: slot={user_slot}, "
            f"role={user_role}, participants={len(participants)}"
        )

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                logger.info(
                    f"WebSocket disconnect message received for {user_name} ({user_slot})"
                )
                break

            if "text" in message:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    logger.warning(
                        f"Invalid JSON from {user_slot} ({user_name}): "
                        f"{message['text'][:100]}"
                    )
                    continue

                await ws_audio_service.handle_ws_message(room_id, user_slot, data)

                logger.debug(
                    f"WS message from {user_slot} ({user_name}): "
                    f"type={data.get('type', '?')}"
                )

            elif "bytes" in message:
                await ws_audio_service.handle_audio_frame(
                    room_id,
                    user_slot,
                    message["bytes"],
                )

    except WebSocketDisconnect:
        logger.info(
            f"WebSocket disconnected: {user_name} ({user_slot}) from room {room_id}"
        )
    except Exception as error:
        logger.error(
            f"WebSocket error for {user_slot} ({user_name}) in room {room_id}: {error}",
            exc_info=True,
        )
    finally:
        logger.info(
            f"Cleaning up WebSocket for {user_name} ({user_slot}) in room {room_id}"
        )
        await ws_audio_service.disconnect_user(room_id, user_slot, websocket)
