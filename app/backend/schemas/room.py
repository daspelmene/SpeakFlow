from uuid import UUID
from pydantic import BaseModel


class RoomCreateResponse(BaseModel):
    room_id: UUID
    invited_user_id: int
    invited_user_name: str


class RoomInvitation(BaseModel):
    room_id: UUID
    creator_user_id: int
    creator_user_name: str


class RoomInvitationsResponse(BaseModel):
    invitations: list[RoomInvitation]


class RoomJoinRequest(BaseModel):
    room_id: UUID


class RoomJoinResponse(BaseModel):
    room_id: UUID
    user_slot: str


class RoomDeclineRequest(BaseModel):
    room_id: UUID


class MessageResponse(BaseModel):
    message: str