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

    def register_room(
        self,
        room_id: str,
        creator_name: str,
        invited_name: str,
        creator_user_id: int | None = None,
        invited_user_id: int | None = None,
    ):
        logger.info(
            f"Registering room {room_id} for WebSocket: "
            f"creator={creator_name} (helper), invited={invited_name} (learner)"
        )

        self.rooms[room_id] = {
            "user1": None,
            "user2": None,
            "cleaning_up": False,
            "creator_name": creator_name,
            "invited_name": invited_name,
            "creator_user_id": str(creator_user_id) if creator_user_id is not None else None,
            "invited_user_id": str(invited_user_id) if invited_user_id is not None else None,
            "roles": {
                "user1": "helper",
                "user2": "learner",
            },
            "created_at": datetime.now(),
        }

    async def end_room(self, room_id: str, reason: str = "Room ended"):
        room = self.rooms.get(room_id)

        if not room:
            logger.info(f"[ROOM-END] Room {room_id} is not in WebSocket memory")
            return

        for slot in ("user1", "user2"):
            user_data = room.get(slot)

            if user_data and user_data.get("ws"):
                await self._ws_send(
                    user_data["ws"],
                    {
                        "type": "room-ended",
                        "reason": reason,
                    },
                )

        await self.cleanup_room(room_id)
        
    async def ws_connect(
        self, room_id: str, user_id: str, websocket: WebSocket
    ) -> dict:
        """Register a WebSocket connection for a user in a room.

        The slot is assigned from database-backed room metadata:
        creator -> user1, invited user -> user2.
        """
        room_id = room_id.strip()

        if not room_id or room_id not in self.rooms:
            logger.warning(f"WebSocket connect failed: room {room_id} not found")
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Room not found")

        room = self.rooms[room_id]

        # Reconnect to an existing slot.
        for slot in ("user1", "user2"):
            existing = room.get(slot)

            if existing and existing.get("user_id") == user_id:
                logger.info(f"User {user_id} reconnecting as {slot} in room {room_id}")

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
                    "disconnecting": False,
                }

                user_name = existing.get("name", "Unknown")
                user_role = room["roles"].get(slot, "learner")
                other_slot = "user2" if slot == "user1" else "user1"
                other = room.get(other_slot)
                other_muted = other.get("muted", False) if other else False

                await self._ws_send(
                    websocket,
                    {
                        "type": "room-state",
                        "roomId": room_id,
                        "userSlot": slot,
                        "userName": user_name,
                        "role": user_role,
                        "roles": room["roles"],
                        "participants": self._get_participants(room_id),
                    },
                )

                if other and other.get("ws") and not other.get("disconnecting"):
                    await self._ws_send(
                        other["ws"],
                        {
                            "type": "peer-reconnected",
                            "userSlot": slot,
                            "userName": user_name,
                            "userId": int(user_id),
                            "role": user_role,
                            "muted": existing.get("muted", False),
                        },
                    )

                    await self._ws_send(
                        websocket,
                        {
                            "type": "audio-restart-required",
                            "peerSlot": other_slot,
                            "peerMuted": other_muted,
                        },
                    )

                return {
                    "status": "reconnected",
                    "roomId": room_id,
                    "userSlot": slot,
                    "userName": user_name,
                    "role": user_role,
                }

        # New connection: assign slot by database-backed ids.
        creator_user_id = room.get("creator_user_id")
        invited_user_id = room.get("invited_user_id")

        if creator_user_id == user_id:
            user_slot = "user1"
            user_name = room.get("creator_name", "Creator")
        elif invited_user_id == user_id:
            user_slot = "user2"
            user_name = room.get("invited_name", "Invited")
        elif creator_user_id is None and room["user1"] is None:
            user_slot = "user1"
            user_name = room.get("creator_name", "Creator")
        elif invited_user_id is None and room["user2"] is None:
            user_slot = "user2"
            user_name = room.get("invited_name", "Invited")
        else:
            logger.warning(f"User {user_id} is not a participant of room {room_id}")
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "Not a participant of this room",
            )

        if room.get(user_slot) is not None:
            logger.warning(f"Slot {user_slot} is already occupied in room {room_id}")
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Room is full",
            )

        user_role = room["roles"].get(user_slot, "learner")

        room[user_slot] = {
            "ws": websocket,
            "user_id": user_id,
            "name": user_name,
            "role": user_role,
            "muted": False,
            "disconnecting": False,
        }

        other_slot = "user2" if user_slot == "user1" else "user1"
        other = room.get(other_slot)

        if other and other.get("ws") and not other.get("disconnecting"):
            await self._ws_send(
                other["ws"],
                {
                    "type": "user-joined",
                    "userSlot": user_slot,
                    "userName": user_name,
                    "userId": int(user_id),
                    "role": user_role,
                    "muted": False,
                },
            )

        return {
            "status": "joined",
            "roomId": room_id,
            "userSlot": user_slot,
            "userName": user_name,
            "role": user_role,
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

        if msg_type == "ping":
            await self._handle_ping(room_id, user_slot, data)

        elif msg_type == "mute":
            await self._handle_mute(room_id, user_slot, data)

        elif msg_type == "switch-roles":
            await self._handle_switch_roles(room_id, user_slot)

        else:
            logger.warning(f"[SIGNALING] Unknown message type: {msg_type}")

    async def _handle_ping(self, room_id: str, user_slot: str, data: dict):
        """Reply to a client keepalive ping with a pong.

        The ping/pong exchange generates traffic in both directions so
        idle-timeout proxies (e.g. the ingress) do not silently drop the
        connection while a user is muted or waiting alone in a room.
        """
        room = self.rooms.get(room_id)
        if not room:
            return

        user_data = room.get(user_slot)
        if user_data and user_data.get("ws"):
            await self._ws_send(
                user_data["ws"],
                {"type": "pong", "ts": data.get("ts")},
            )
            logger.debug(f"[PING] Pong sent to {user_slot} in room {room_id}")

    async def _handle_mute(self, room_id: str, user_slot: str, data: dict):
        """Handle mute/unmute signaling."""
        room = self.rooms.get(room_id)
        if not room:
            logger.warning(f"[MUTE] Room {room_id} not found")
            return

        user_data = room.get(user_slot)
        if user_data:
            muted = data.get("muted", False)
            user_data["muted"] = muted
            other_slot = "user2" if user_slot == "user1" else "user1"
            other = room.get(other_slot)
            if other and other.get("ws") and not other.get("disconnecting"):
                await self._ws_send(
                    other["ws"],
                    {
                        "type": "mute",
                        "userSlot": user_slot,
                        "muted": muted,
                    },
                )
                logger.info(
                    f"[MUTE] User {user_slot} ({user_data.get('name')}) "
                    f"muted={muted}, notified {other_slot}"
                )

    async def _handle_switch_roles(self, room_id: str, user_slot: str):
        """Handle role switching between helper and learner."""
        room = self.rooms.get(room_id)
        if not room:
            logger.warning(f"[ROLES] Room {room_id} not found for switch")
            return

        current_roles = room.get("roles", {})
        user1_role = current_roles.get("user1", "learner")
        user2_role = current_roles.get("user2", "learner")

        # Swap roles
        current_roles["user1"] = user2_role
        current_roles["user2"] = user1_role
        room["roles"] = current_roles

        logger.info(
            f"[ROLES] Switched roles in room {room_id}: "
            f"user1={current_roles['user1']}, user2={current_roles['user2']}"
        )

        # Update role in user data
        for slot in ("user1", "user2"):
            user_data = room.get(slot)
            if user_data:
                user_data["role"] = current_roles[slot]

        # Notify both users about the role switch
        for slot in ("user1", "user2"):
            user_data = room.get(slot)
            if user_data and user_data.get("ws") and not user_data.get("disconnecting"):
                await self._ws_send(
                    user_data["ws"],
                    {
                        "type": "roles-updated",
                        "roles": current_roles,
                        "yourRole": current_roles[slot],
                        "yourSlot": slot,
                    },
                )
                logger.info(
                    f"[ROLES] Sent roles-updated to {slot}: "
                    f"role={current_roles[slot]}"
                )

    # ------------------------------------------------------------------
    # Disconnect / cleanup
    # ------------------------------------------------------------------

    async def disconnect_user(
        self, room_id: str, user_slot: str, websocket: WebSocket | None = None
    ):
        """Disconnect a user with a 3-second grace period for reconnection.

        If ``websocket`` is given, the disconnect is skipped when the slot
        is already owned by a newer connection (the user reconnected before
        the stale socket finished dying).
        """
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

        if websocket is not None and user_data.get("ws") is not websocket:
            logger.info(
                f"[DISCONNECT] Stale socket for {user_slot} in room {room_id} "
                f"closed after reconnect; keeping the new connection"
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
            if other and other.get("ws") and not other.get("disconnecting"):
                await self._ws_send(
                    other["ws"],
                    {
                        "type": "peer-disconnected",
                        "userSlot": user_slot,
                        "userName": user_name,
                    }
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

    def _get_participants(self, room_id: str) -> list[dict]:
        room = self.rooms.get(room_id)

        if not room:
            return []

        participants = []

        for slot in ("user1", "user2"):
            ud = room.get(slot)

            if ud and not ud.get("disconnecting"):
                raw_user_id = ud.get("user_id")

                participants.append(
                    {
                        "slot": slot,
                        "name": ud.get("name", "Unknown"),
                        "userId": int(raw_user_id)
                        if str(raw_user_id).isdigit()
                        else None,
                        "role": room["roles"].get(slot, "learner"),
                        "muted": ud.get("muted", False),
                    }
                )

        return participants

    def get_room_info(self, room_id: str) -> dict | None:
        """Get information about a room including roles and mute states."""
        room = self.rooms.get(room_id)
        if not room:
            logger.debug(f"[QUERY] Room {room_id} not found for info")
            return None

        participants = self._get_participants(room_id)
        return {
            "roomId": room_id,
            "participants": participants,
            "roles": room.get("roles", {}),
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