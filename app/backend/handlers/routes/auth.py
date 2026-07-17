from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from config.config import settings
from models.user import User

from schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from storage.database import Database
from utils.hasher import Hasher
from utils.jwt import (
    _get_user_id,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


def _start_session(user: User) -> str:
    session_id = uuid4().hex
    user.active_session_id = session_id
    user.active_session_expires_at = datetime.now() + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return session_id


def _tokens(user: User, session_id: str) -> TokenResponse:
    claims = {"sub": str(user.id), "sid": session_id}
    return TokenResponse(
        access_token=create_access_token(claims),
        refresh_token=create_refresh_token(claims),
    )


@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest, db: Database = Depends(Database.get_db)):
    existing = await db.users.get_user_by_email(data.email)
    if existing:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This email is already registered. Try logging in instead.",
        )

    password_hash = Hasher.hash_password(data.password)
    session_id = uuid4().hex
    user = await db.users.create_user(
        {
            "email": data.email,
            "password_hash": password_hash,
            "fullname": data.fullname,
            "active_session_id": session_id,
            "active_session_expires_at": datetime.now()
            + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        }
    )

    return _tokens(user, session_id)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: Database = Depends(Database.get_db)):
    user = await db.users.get_user_by_email_for_update(data.email)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid email or password")

    if not Hasher.verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    session_id = _start_session(user)
    await db.users.save_user(user)
    return _tokens(user, session_id)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: Database = Depends(Database.get_db)):
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    user_id = _get_user_id(payload)
    user = await db.users.get_user_by_id(user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    session_id = payload.get("sid")
    if not session_id or session_id != user.active_session_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session is no longer active")

    user.active_session_expires_at = datetime.now() + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    await db.users.save_user(user)
    return _tokens(user, session_id)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    user: User = Depends(get_current_user),
    db: Database = Depends(Database.get_db),
):
    user.active_session_id = None
    user.active_session_expires_at = None
    await db.users.save_user(user)
