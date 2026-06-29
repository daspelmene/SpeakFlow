from pydantic import BaseModel


# --- REST schemas ---


class CreateRoomResponse(BaseModel):
    roomId: str


class JoinRoomRequest(BaseModel):
    roomId: str
    userName: str | None = None


class JoinRoomResponse(BaseModel):
    status: str
    roomId: str
    userSlot: str
    userName: str


class DisconnectRequest(BaseModel):
    roomId: str


class ErrorResponse(BaseModel):
    error: str


class AvailableRoom(BaseModel):
    roomId: str
    userName: str
    created: str


class AvailableRoomsResponse(BaseModel):
    rooms: list[AvailableRoom]


# --- WebSocket message schemas ---


class WSMessage(BaseModel):
    """Base WebSocket message — all messages have a 'type' field."""

    type: str


class WSJoinMessage(WSMessage):
    """Client → Server: join room."""

    type: str = "join"
    roomId: str
    userName: str | None = None


class WSOfferMessage(WSMessage):
    """Client → Server: SDP offer."""

    type: str = "offer"
    sdp: str
    userSlot: str


class WSAnswerMessage(WSMessage):
    """Client → Server: SDP answer (for renegotiation)."""

    type: str = "answer"
    sdp: str
    userSlot: str


class WSIceCandidateMessage(WSMessage):
    """Client → Server: ICE candidate."""

    type: str = "ice-candidate"
    candidate: str
    sdpMid: str | None = None
    sdpMLineIndex: int | None = None
    userSlot: str


class WSUserJoinedMessage(WSMessage):
    """Server → Client: another user joined."""

    type: str = "user-joined"
    userSlot: str
    userName: str


class WSUserLeftMessage(WSMessage):
    """Server → Client: another user left."""

    type: str = "user-left"
    userSlot: str
    userName: str


class WSSdpAnswerMessage(WSMessage):
    """Server → Client: SDP answer (initial connection)."""

    type: str = "sdp-answer"
    sdp: str


class WSNegotiationOfferMessage(WSMessage):
    """Server → Client: renegotiation offer (server added a track)."""

    type: str = "negotiation-offer"
    sdp: str


class WSIceCandidateServerMessage(WSMessage):
    """Server → Client: ICE candidate from server's peer connection."""

    type: str = "ice-candidate"
    candidate: str
    sdpMid: str | None = None
    sdpMLineIndex: int | None = None


class WSErrorMessage(WSMessage):
    """Server → Client: error notification."""

    type: str = "error"
    message: str


class WSRoomStateMessage(WSMessage):
    """Server → Client: current room state after joining."""

    type: str = "room-state"
    roomId: str
    userSlot: str
    userName: str
    participants: list[dict]  # [{"slot": "user1", "name": "Alice"}]
