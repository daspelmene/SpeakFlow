import asyncio
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path

from aiortc import RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
from aiortc.contrib.media import MediaRecorder, MediaRelay
from fastapi import HTTPException, status

logger = logging.getLogger("webrtc-audio")
logging.getLogger("aioice").setLevel(logging.ERROR)

RECORDINGS_DIR = Path("recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)


# to manage webrtc audio rooms, relay, and recordings
class AudioService:
    def __init__(self):
        self.relay = MediaRelay()
        self.rooms: dict = {}

    def create_room(self) -> str:
        room_id = str(uuid.uuid4())[:8]
        self.rooms[room_id] = {
            "user1": None,
            "user2": None,
            "recorders": {},
            "recording_files": {},
            "recording_started": False,
            "cleaning_up": False,
        }
        logger.info(f"Room {room_id} created")
        return room_id

    def check_renegotiate(self, room_id: str, user_slot: str) -> bool:
        room = self.rooms.get(room_id)
        if not room:
            return False
        user_data = room.get(user_slot)
        if user_data and user_data.get("needs_renegotiate"):
            user_data["needs_renegotiate"] = False
            return True
        return False

    async def join_room(self, room_id: str, user_id: str, user_name: str) -> dict:
        room_id = room_id.strip()
        user_name = user_name.strip()

        if not room_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "roomId required")
        if room_id not in self.rooms:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Room not found")

        room = self.rooms[room_id]

        if room["user1"] is None:
            user_slot = "user1"
        elif room["user2"] is None:
            user_slot = "user2"
        else:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Room is full")

        pc = RTCPeerConnection()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        recording_file = str(RECORDINGS_DIR / f"room_{room_id}_{user_id}_{timestamp}.wav")
        room["recording_files"][user_slot] = recording_file

        room[user_slot] = {
            "pc": pc,
            "name": user_name,
            "user_id": user_id,
            "audio_track": None,
            "needs_renegotiate": False,
        }

        logger.info(f"{user_name} joined as {user_slot}")

        @pc.on("track")
        async def on_track(track):
            logger.info(f"📡 Track from {user_name}: {track.kind}")
            if track.kind == "audio":
                room[user_slot]["audio_track"] = track
                # to let sdp exchange complete
                await asyncio.sleep(0.5)
                await self._try_relay(room_id, user_slot)
                await self._try_start_recording(room_id)

        @pc.on("connectionstatechange")
        async def on_state_change():
            logger.info(f"State {user_name}: {pc.connectionState}")
            if pc.connectionState == "connected":
                logger.info(f"{user_name} connected")
                await asyncio.sleep(0.3)
                await self._try_relay(room_id, user_slot)
                await self._try_start_recording(room_id)
            elif pc.connectionState in ["failed", "closed"]:
                await self._cleanup_room(room_id)

        return {
            "status": "joined",
            "roomId": room_id,
            "userSlot": user_slot,
            "userName": user_name,
        }

    async def handle_offer(self, room_id: str, user_slot: str, sdp: str, offer_type: str) -> dict:
        room = self.rooms.get(room_id)
        if not room:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Room not found")

        user_data = room.get(user_slot)
        if not user_data:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found in room")

        pc = user_data["pc"]
        offer = RTCSessionDescription(sdp=sdp, type=offer_type)
        await pc.setRemoteDescription(offer)
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        # try relay after sdp exchange
        await asyncio.sleep(0.3)
        await self._try_relay(room_id, user_slot)
        await self._try_start_recording(room_id)

        return {
            "sdp": pc.localDescription.sdp if pc.localDescription else "",
            "type": "answer",
        }

    async def handle_ice(self, room_id: str, user_slot: str, candidate_data: dict):
        room = self.rooms.get(room_id)
        if not room:
            return

        user_data = room.get(user_slot)
        if not user_data:
            return

        candidate_str = candidate_data.get("candidate", "")
        if not candidate_str:
            return

        parts = candidate_str.split()
        for i, p in enumerate(parts):
            if p == "candidate:" and i + 7 < len(parts):
                candidate = RTCIceCandidate(
                    foundation=parts[i + 1], component=int(parts[i + 2]),
                    protocol=parts[i + 3].lower(), priority=int(parts[i + 4]),
                    ip=parts[i + 5], port=int(parts[i + 6]),
                    type=parts[i + 8] if i + 8 < len(parts) and parts[i + 7] == "typ" else "host",
                    sdpMid=candidate_data.get("sdpMid"),
                    sdpMLineIndex=candidate_data.get("sdpMLineIndex"),
                )
                try:
                    await user_data["pc"].addIceCandidate(candidate)
                except Exception:
                    pass
                return

    async def disconnect(self, room_id: str):
        await self._cleanup_room(room_id)

    async def _try_relay(self, room_id: str, from_slot: str):
        # relay audio between users
        room = self.rooms.get(room_id)
        if not room:
            return

        u1 = room.get("user1")
        u2 = room.get("user2")
        if not u1 or not u2:
            return

        # Relay user1 -> user2
        if u1.get("audio_track") and u2.get("pc") and not u1.get("relayed_to_u2"):
            try:
                logger.info(f"Attempting relay {u1['name']} -> {u2['name']} (state: {u2['pc'].signalingState})")
                if u2["pc"].signalingState == "stable":
                    r = self.relay.subscribe(u1["audio_track"])
                    u2["pc"].addTrack(r)
                    u2["needs_renegotiate"] = True
                    u1["relayed_to_u2"] = True
                    logger.info(f"Relayed {u1['name']} -> {u2['name']}")
                else:
                    logger.warning(f"Cannot relay to {u2['name']}: signalingState={u2['pc'].signalingState}")
            except Exception as e:
                logger.error(f"Relay u1->u2 error: {e}")

        # Relay user2 -> user1
        if u2.get("audio_track") and u1.get("pc") and not u2.get("relayed_to_u1"):
            try:
                logger.info(f"Attempting relay {u2['name']} -> {u1['name']} (state: {u1['pc'].signalingState})")
                if u1["pc"].signalingState == "stable":
                    r = self.relay.subscribe(u2["audio_track"])
                    u1["pc"].addTrack(r)
                    u1["needs_renegotiate"] = True
                    u2["relayed_to_u1"] = True
                    logger.info(f"Relayed {u2['name']} -> {u1['name']}")
                else:
                    logger.warning(f"Cannot relay to {u1['name']}: signalingState={u1['pc'].signalingState}")
            except Exception as e:
                logger.error(f"Relay u2->u1 error: {e}")

    async def _try_start_recording(self, room_id: str):
        room = self.rooms.get(room_id)
        if not room or room["recording_started"]:
            return

        u1 = room.get("user1")
        u2 = room.get("user2")
        if not u1 or not u2:
            return
        if u1["pc"].connectionState != "connected" or u2["pc"].connectionState != "connected":
            return

        room["recording_started"] = True
        logger.info(f"Starting recordings for room {room_id}")

        tasks = []
        for slot in ["user1", "user2"]:
            user_data = room.get(slot)
            if user_data and user_data.get("audio_track"):
                rec_file = room["recording_files"][slot]
                relayed = self.relay.subscribe(user_data["audio_track"])
                rec = MediaRecorder(rec_file)
                rec.addTrack(relayed)
                tasks.append(rec.start())
                room["recorders"][slot] = rec

        await asyncio.gather(*tasks)
        for slot in room["recorders"]:
            logger.info(f"Recording {room[slot]['name']}")

    async def _cleanup_room(self, room_id: str):
        room = self.rooms.get(room_id)
        if not room or room.get("cleaning_up"):
            return

        room["cleaning_up"] = True
        logger.info(f"Cleaning up room {room_id}")

        if room["recording_started"]:
            for slot in list(room["recorders"].keys()):
                try:
                    await room["recorders"][slot].stop()
                except Exception:
                    pass

        for slot in ["user1", "user2"]:
            rec_file = room["recording_files"].get(slot)
            if rec_file and os.path.exists(rec_file) and os.path.getsize(rec_file) > 44:
                await self._convert_wav_to_mp3(rec_file)

        for slot in ["user1", "user2"]:
            user_data = room.get(slot)
            if user_data:
                try:
                    await user_data["pc"].close()
                except Exception:
                    pass

        if room_id in self.rooms:
            del self.rooms[room_id]
        logger.info(f"Room {room_id} deleted")

    @staticmethod
    async def _convert_wav_to_mp3(wav_path: str):
        try:
            mp3_path = wav_path.replace('.wav', '.mp3')
            proc = await asyncio.create_subprocess_exec(
                'lame', '-b', '128', wav_path, mp3_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                await asyncio.wait_for(proc.wait(), timeout=120)
            except asyncio.TimeoutError:
                proc.kill()
                logger.error(f"Conversion timeout: {wav_path}")
                return

            if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                logger.info(f"MP3 ({round(os.path.getsize(mp3_path) / 1024, 1)}KB)")
                os.remove(wav_path)
        except Exception as e:
            logger.error(f"Conversion error: {e}")

    def get_available_rooms(self) -> list[dict]:
        available = []
        for room_id, room in self.rooms.items():
            if room.get("user1") and not room.get("user2"):
                if not room.get("cleaning_up"):
                    available.append({
                        "roomId": room_id,
                        "userName": room["user1"]["name"],
                        "created": datetime.now().isoformat(),
                    })
        return available


audio_service = AudioService()
