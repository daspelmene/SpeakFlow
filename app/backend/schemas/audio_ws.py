from pydantic import BaseModel


# --- REST schemas ---


class CreateRoomResponse(BaseModel):
    roomId: str


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
