import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import WebSocket, HTTPException, status

logger = logging.getLogger("ws-audio")


class WSAudioService:
    """WebSocket audio room service.

    Architecture:
        Browser1 --WS binary--> Server --WS binary--> Browser2

    Signaling + audio share one WebSocket per user.
    Text frames = signaling JSON; Binary frames = audio data.

    The server does NOT decode or process audio — it simply forwards
    binary chunks between participants.
    """

    def __init__(self):
        self.rooms: dict[str, dict] = {}
        self._pending_disconnects: dict[str, dict[str, asyncio.Task]] = {}

    # ------------------------------------------------------------------
    # Room lifecycle
    # ------------------------------------------------------------------

    def create_room(self) -> str:
        room_id = str(uuid.uuid4())[:8]
        self.rooms[room_id] = {
            "user1": None,
            "user2": None,
            "cleaning_up": False,
            "created_at": datetime.now(),
        }
        logger.info(f"Room {room_id} created")
        return room_id

    async def ws_connect(
        self, room_id: str, user_id: str, user_name: str, websocket: WebSocket
    ) -> dict:
        """Register a WebSocket connection for a user in a room."""
        room_id = room_id.strip()
        user_name = user_name.strip()

        if not room_id or room_id not in self.rooms:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Room not found")

        room = self.rooms[room_id]

        # Reconnect: if user was previously in the room, reuse slot
        for slot in ("user1", "user2"):
            existing = room.get(slot)
            if existing and existing.get("user_id") == user_id:
                logger.info(f"User {user_name} reconnecting as {slot}")
                existing["disconnecting"] = True

                # Cancel pending deferred disconnect for this slot
                pending = self._pending_disconnects.get(room_id, {})
                pending_task = pending.pop(slot, None)
                if pending_task and not pending_task.done():
                    pending_task.cancel()
                    logger.info(
                        f"Cancelled deferred disconnect for reconnecting user {user_name}"
                    )

                room[slot] = {
                    **existing,
                    "ws": websocket,
                    "muted": existing.get("muted", False),
                    "disconnecting": False,
                }

                # Notify the other user that someone rejoined
                other_slot = "user2" if slot == "user1" else "user1"
                other = room.get(other_slot)
                if other and other.get("ws") and not other.get("disconnecting"):
                    await self._ws_send(
                        other["ws"],
                        {
                            "type": "user-joined",
                            "userSlot": slot,
                            "userName": user_name,
                        },
                    )

                return {
                    "status": "reconnected",
                    "roomId": room_id,
                    "userSlot": slot,
                    "userName": user_name,
                }

        # New join — find empty slot
        if room["user1"] is None:
            user_slot = "user1"
        elif room["user2"] is None:
            user_slot = "user2"
        else:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Room is full")

        room[user_slot] = {
            "ws": websocket,
            "name": user_name,
            "user_id": user_id,
            "muted": False,
            "disconnecting": False,
        }

        logger.info(f"{user_name} joined as {user_slot}")

        # CRITICAL FIX: Notify the existing user BEFORE returning to the new user.
        # This gives the existing user's client time to restart its MediaRecorder
        # so that the first audio chunks the new user receives have proper WebM headers.
        other_slot = "user2" if user_slot == "user1" else "user1"
        other = room.get(other_slot)
        if other and other.get("ws") and not other.get("disconnecting"):
            await self._ws_send(
                other["ws"],
                {
                    "type": "user-joined",
                    "userSlot": user_slot,
                    "userName": user_name,
                },
            )
            logger.info(f"Sent user-joined to {other_slot} for {user_slot}")

            # Small delay to ensure the existing user has time to restart their MediaRecorder
            await asyncio.sleep(0.1)

        return {
            "status": "joined",
            "roomId": room_id,
            "userSlot": user_slot,
            "userName": user_name,
        }

    # ------------------------------------------------------------------
    # Audio forwarding (replaces entire WebRTC MediaRelay)
    # ------------------------------------------------------------------

    async def handle_audio_frame(self, room_id: str, from_slot: str, data: bytes):
        room = self.rooms.get(room_id)
        if not room:
            logger.warning(f"[AUDIO] No room {room_id}")
            return

        other_slot = "user2" if from_slot == "user1" else "user1"
        other = room.get(other_slot)

        logger.info(
            f"[AUDIO] {from_slot} -> {other_slot}: {len(data)} bytes, ws={bool(other and other.get('ws'))}"
        )

        if other and other.get("ws") and not other.get("disconnecting"):
            try:
                await other["ws"].send_bytes(data)
                logger.debug(f"[AUDIO] Forwarded {len(data)} bytes to {other_slot}")
            except Exception as e:
                logger.error(f"[AUDIO] Failed to forward to {other_slot}: {e}")
        else:
            logger.warning(
                f"[AUDIO] Cannot forward: other_exists={bool(other)}, ws={bool(other.get('ws') if other else False)}"
            )

    # ------------------------------------------------------------------
    # Signaling messages
    # ------------------------------------------------------------------

    async def handle_ws_message(self, room_id: str, user_slot: str, data: dict):
        """Handle text (signaling) messages from client."""
        msg_type = data.get("type")

        if msg_type == "mute":
            room = self.rooms.get(room_id)
            if not room:
                return
            user_data = room.get(user_slot)
            if user_data:
                user_data["muted"] = data.get("muted", False)
                other_slot = "user2" if user_slot == "user1" else "user1"
                other = room.get(other_slot)
                if other and other.get("ws"):
                    await self._ws_send(
                        other["ws"],
                        {
                            "type": "mute",
                            "userSlot": user_slot,
                            "muted": user_data["muted"],
                        },
                    )
        else:
            logger.warning(f"Unknown WS message type: {msg_type}")

    # ------------------------------------------------------------------
    # Disconnect / cleanup
    # ------------------------------------------------------------------

    async def disconnect_user(self, room_id: str, user_slot: str):
        """Disconnect a user with a 3-second grace period for reconnection."""
        room = self.rooms.get(room_id)
        if not room:
            return

        user_data = room.get(user_slot)
        if not user_data:
            return

        user_name = user_data.get("name", user_slot)
        logger.info(f"Disconnecting {user_name} ({user_slot}) from room {room_id}")

        # Mark as disconnecting
        user_data["disconnecting"] = True

        async def _deferred_disconnect():
            await asyncio.sleep(3.0)  # Grace period
            room = self.rooms.get(room_id)
            if not room:
                return
            # If the user reconnected, their slot will have disconnecting=False
            user_data = room.get(user_slot)
            if user_data and not user_data.get("disconnecting"):
                logger.info(f"Reconnected user {user_name} skipped deferred disconnect")
                return

            logger.info(f"Grace period expired, finalizing disconnect for {user_name}")

            # Notify other participant
            other_slot = "user2" if user_slot == "user1" else "user1"
            other = room.get(other_slot)
            if other and other.get("ws"):
                await self._ws_send(
                    other["ws"],
                    {
                        "type": "user-left",
                        "userSlot": user_slot,
                        "userName": user_name,
                    },
                )

            # Clear slot
            room[user_slot] = None

            # Clean up pending disconnects entry
            pending = self._pending_disconnects.get(room_id, {})
            pending.pop(user_slot, None)

            # If room is empty, clean up
            if room.get("user1") is None and room.get("user2") is None:
                await self._cleanup_room(room_id)

        # Store the disconnect task so ws_connect can cancel it on reconnect
        disconnect_task = asyncio.create_task(_deferred_disconnect())
        if room_id not in self._pending_disconnects:
            self._pending_disconnects[room_id] = {}
        self._pending_disconnects[room_id][user_slot] = disconnect_task

    async def disconnect(self, room_id: str):
        """Full room disconnect (compatibility with REST endpoint)."""
        await self._cleanup_room(room_id)

    async def _cleanup_room(self, room_id: str):
        room = self.rooms.get(room_id)
        if not room or room.get("cleaning_up"):
            return

        room["cleaning_up"] = True
        logger.info(f"Cleaning up room {room_id}")

        # Mark all users as disconnecting
        for slot in ("user1", "user2"):
            user_data = room.get(slot)
            if user_data:
                user_data["disconnecting"] = True

        if room_id in self.rooms:
            del self.rooms[room_id]

        # Cancel any pending deferred disconnects for this room
        pending = self._pending_disconnects.pop(room_id, {})
        for task in pending.values():
            if not task.done():
                task.cancel()

        logger.info(f"Room {room_id} deleted")

    # ------------------------------------------------------------------
    # Room queries
    # ------------------------------------------------------------------

    def get_available_rooms(self) -> list[dict]:
        available = []
        for room_id, room in self.rooms.items():
            if room.get("user1") and not room.get("user2"):
                if not room.get("cleaning_up"):
                    available.append(
                        {
                            "roomId": room_id,
                            "userName": room["user1"]["name"],
                            "created": room.get(
                                "created_at", datetime.now()
                            ).isoformat(),
                        }
                    )
        return available

    def get_room_info(self, room_id: str) -> dict | None:
        room = self.rooms.get(room_id)
        if not room:
            return None
        participants = []
        for slot in ("user1", "user2"):
            ud = room.get(slot)
            if ud:
                participants.append({"slot": slot, "name": ud.get("name", "")})
        return {
            "roomId": room_id,
            "participants": participants,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _ws_send(websocket: WebSocket, data: dict[str, Any]):
        """Safely send a JSON message over WebSocket."""
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.warning(f"WebSocket send failed: {e}")


# Module-level singleton
ws_audio_service = WSAudioService()
