from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str
    fullname: str
    native_language: str
    target_language: str
    interests: list[str] = []
    bio: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
