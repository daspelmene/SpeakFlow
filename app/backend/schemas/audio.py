from pydantic import BaseModel


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


class RenegotiateResponse(BaseModel):
    renegotiate: bool


class IceCandidateData(BaseModel):
    candidate: str
    sdpMid: str | None = None
    sdpMLineIndex: int | None = None


class SDPOfferRequest(BaseModel):
    sdp: str
    type: str = "offer"
    roomId: str
    userSlot: str


class SDPAnswerResponse(BaseModel):
    sdp: str
    type: str = "answer"


class IceCandidateRequest(BaseModel):
    roomId: str
    userSlot: str
    candidate: IceCandidateData


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