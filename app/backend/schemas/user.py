from datetime import datetime

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: int
    interests: list[str]
    bio: str | None


class UserMeResponse(BaseModel):
    id: int
    email: str
    fullname: str
    native_language: str | None
    target_language: str | None
    interests: list[str]
    bio: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UpdateUserRequest(BaseModel):
    fullname: str | None = None
    native_language: str | None = None
    target_language: str | None = None
    interests: list[str] | None = None
    bio: str | None = None
