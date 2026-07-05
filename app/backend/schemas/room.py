from uuid import UUID
from pydantic import BaseModel


class RoomCreateResponse(BaseModel):
    room_id: UUID
    invited_user_id: int
    invited_user_name: str


class UserProfileSummary(BaseModel):
    """Brief user profile for invitation card."""
    user_id: int
    fullname: str
    native_language: str | None = None
    target_language: str | None = None
    interests: list[str] = []
    bio: str | None = None


class RoomInvitation(BaseModel):
    room_id: UUID
    creator_user_id: int
    creator_user_name: str
    creator_profile: UserProfileSummary | None = None


class RoomInvitationsResponse(BaseModel):
    invitations: list[RoomInvitation]


class RoomJoinRequest(BaseModel):
    room_id: UUID


class RoomJoinResponse(BaseModel):
    room_id: UUID
    user_slot: str
    role: str  # "helper" or "learner"


class RoomDeclineRequest(BaseModel):
    room_id: UUID


class ActiveRoomResponse(BaseModel):
    room_id: UUID
    user_slot: str
    role: str  # "helper" or "learner"


class MessageResponse(BaseModel):
    message: str