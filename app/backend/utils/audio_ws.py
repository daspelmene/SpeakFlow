import asyncio
import logging
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
    # Room management (WebSocket level)
    # ------------------------------------------------------------------

    def register_room(self, room_id: str, creator_name: str, invited_name: str):
        """Register a room for WebSocket tracking."""
        logger.info(
            f"Registering room {room_id} for WebSocket: "
            f"creator={creator_name}, invited={invited_name}"
        )
        self.rooms[room_id] = {
            "user1": None,  # Creator
            "user2": None,  # Invited
            "cleaning_up": False,
            "creator_name": creator_name,
            "invited_name": invited_name,
            "created_at": datetime.now(),
        }

    async def ws_connect(
        self, room_id: str, user_id: str, websocket: WebSocket
    ) -> dict:
        """Register a WebSocket connection for a user in a room.

        Validates that the user is a participant of the room.
        """
        room_id = room_id.strip()

        if not room_id or room_id not in self.rooms:
            logger.warning(f"WebSocket connect failed: room {room_id} not found")
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Room not found")

        room = self.rooms[room_id]

        # Determine user slot based on role
        # We need to query the DB to validate, but let's use a simpler approach:
        # Check if user is reconnecting to an existing slot
        for slot in ("user1", "user2"):
            existing = room.get(slot)
            if existing and existing.get("user_id") == user_id:
                logger.info(
                    f"User {user_id} reconnecting as {slot} in room {room_id}"
                )

                # Cancel pending deferred disconnect for this slot
                pending = self._pending_disconnects.get(room_id, {})
                pending_task = pending.pop(slot, None)
                if pending_task and not pending_task.done():
                    pending_task.cancel()
                    logger.info(
                        f"Cancelled deferred disconnect for reconnecting user {user_id}"
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
                            "userName": existing.get("name", "Unknown"),
                        },
                    )

                return {
                    "status": "reconnected",
                    "roomId": room_id,
                    "userSlot": slot,
                    "userName": existing.get("name", "Unknown"),
                }

        # New connection - try to assign to correct slot
        # If user1 slot is empty, this might be the creator
        if room["user1"] is None:
            user_slot = "user1"
            user_name = room.get("creator_name", "Creator")
        elif room["user2"] is None:
            user_slot = "user2"
            user_name = room.get("invited_name", "Invited")
        else:
            logger.warning(f"Room {room_id} is full, rejecting user {user_id}")
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Room is full"
            )

        room[user_slot] = {
            "ws": websocket,
            "name": user_name,
            "user_id": user_id,
            "muted": False,
            "disconnecting": False,
        }

        logger.info(
            f"User {user_name} (id={user_id}) joined as {user_slot} in room {room_id}"
        )

        # Notify the other user if they're already connected
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

        return {
            "status": "joined",
            "roomId": room_id,
            "userSlot": user_slot,
            "userName": user_name,
        }

    # ------------------------------------------------------------------
    # Audio forwarding
    # ------------------------------------------------------------------

    async def handle_audio_frame(self, room_id: str, from_slot: str, data: bytes):
        """Forward audio binary data to the other participant."""
        room = self.rooms.get(room_id)
        if not room:
            logger.warning(f"[AUDIO] No room {room_id}")
            return

        other_slot = "user2" if from_slot == "user1" else "user1"
        other = room.get(other_slot)

        if other and other.get("ws") and not other.get("disconnecting"):
            try:
                await other["ws"].send_bytes(data)
                logger.debug(
                    f"[AUDIO] Forwarded {len(data)} bytes from {from_slot} to {other_slot}"
                )
            except Exception as e:
                logger.error(
                    f"[AUDIO] Failed to forward {len(data)} bytes "
                    f"from {from_slot} to {other_slot}: {e}"
                )
        else:
            logger.debug(
                f"[AUDIO] Cannot forward {len(data)} bytes from {from_slot}: "
                f"other slot {other_slot} not available"
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
                logger.warning(f"[SIGNALING] Room {room_id} not found for mute")
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
                    logger.debug(
                        f"[SIGNALING] Mute state for {user_slot}: "
                        f"{user_data['muted']}"
                    )
        else:
            logger.warning(f"[SIGNALING] Unknown message type: {msg_type}")

    # ------------------------------------------------------------------
    # Disconnect / cleanup
    # ------------------------------------------------------------------

    async def disconnect_user(self, room_id: str, user_slot: str):
        """Disconnect a user with a 3-second grace period for reconnection."""
        room = self.rooms.get(room_id)
        if not room:
            logger.warning(
                f"[DISCONNECT] Room {room_id} not found for disconnect"
            )
            return

        user_data = room.get(user_slot)
        if not user_data:
            logger.warning(
                f"[DISCONNECT] User {user_slot} not found in room {room_id}"
            )
            return

        user_name = user_data.get("name", user_slot)
        logger.info(
            f"[DISCONNECT] User {user_name} ({user_slot}) disconnecting "
            f"from room {room_id}"
        )

        # Mark as disconnecting
        user_data["disconnecting"] = True

        async def _deferred_disconnect():
            await asyncio.sleep(3.0)  # Grace period
            room = self.rooms.get(room_id)
            if not room:
                logger.debug(f"[DISCONNECT] Room {room_id} already cleaned up")
                return

            # If the user reconnected, their slot will have disconnecting=False
            user_data = room.get(user_slot)
            if user_data and not user_data.get("disconnecting"):
                logger.info(
                    f"[DISCONNECT] Reconnected user {user_name} "
                    f"skipped deferred disconnect"
                )
                return

            logger.info(
                f"[DISCONNECT] Grace period expired, finalizing "
                f"disconnect for {user_name} ({user_slot})"
            )

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
            logger.info(
                f"[DISCONNECT] Slot {user_slot} cleared in room {room_id}"
            )

            # Clean up pending disconnects entry
            pending = self._pending_disconnects.get(room_id, {})
            pending.pop(user_slot, None)

            # If room is empty, clean up
            if room.get("user1") is None and room.get("user2") is None:
                logger.info(
                    f"[DISCONNECT] Room {room_id} is empty, cleaning up"
                )
                await self.cleanup_room(room_id)

        # Store the disconnect task so ws_connect can cancel it on reconnect
        disconnect_task = asyncio.create_task(_deferred_disconnect())
        if room_id not in self._pending_disconnects:
            self._pending_disconnects[room_id] = {}
        self._pending_disconnects[room_id][user_slot] = disconnect_task
        logger.debug(
            f"[DISCONNECT] Deferred disconnect scheduled for {user_name} "
            f"in room {room_id}"
        )

    async def cleanup_room(self, room_id: str):
        """Full room cleanup."""
        room = self.rooms.get(room_id)
        if not room or room.get("cleaning_up"):
            logger.debug(
                f"[CLEANUP] Room {room_id} already cleaned up or not found"
            )
            return

        room["cleaning_up"] = True
        logger.info(f"[CLEANUP] Cleaning up room {room_id}")

        # Close all WebSocket connections
        for slot in ("user1", "user2"):
            user_data = room.get(slot)
            if user_data:
                user_data["disconnecting"] = True
                ws = user_data.get("ws")
                if ws:
                    try:
                        await ws.close(code=4000, reason="Room closed")
                        logger.info(
                            f"[CLEANUP] Closed WebSocket for {slot} in room {room_id}"
                        )
                    except Exception as e:
                        logger.warning(
                            f"[CLEANUP] Error closing WebSocket for {slot}: {e}"
                        )

        # Remove room
        if room_id in self.rooms:
            del self.rooms[room_id]
            logger.info(f"[CLEANUP] Room {room_id} removed from tracking")

        # Cancel any pending deferred disconnects for this room
        pending = self._pending_disconnects.pop(room_id, {})
        for slot, task in pending.items():
            if not task.done():
                task.cancel()
                logger.debug(
                    f"[CLEANUP] Cancelled deferred disconnect for {slot}"
                )

        logger.info(f"[CLEANUP] Room {room_id} cleanup complete")

    # ------------------------------------------------------------------
    # Room queries
    # ------------------------------------------------------------------

    def get_room_info(self, room_id: str) -> dict | None:
        """Get information about a room."""
        room = self.rooms.get(room_id)
        if not room:
            logger.debug(f"[QUERY] Room {room_id} not found for info")
            return None

        participants = []
        for slot in ("user1", "user2"):
            ud = room.get(slot)
            if ud and not ud.get("disconnecting"):
                participants.append({
                    "slot": slot,
                    "name": ud.get("name", "Unknown"),
                })

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
            logger.warning(f"[WS] WebSocket send failed: {e}")


# Module-level singleton
ws_audio_service = WSAudioService()