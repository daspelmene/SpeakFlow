from fastapi import APIRouter, Depends, HTTPException, status

from app.backend.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from app.backend.storage.database import Database
from app.backend.utils.hasher import Hasher
from app.backend.utils.jwt import _get_user_id, create_access_token, create_refresh_token, decode_token

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse)
async def register(data: RegisterRequest, db: Database = Depends(Database.get_db)):
    existing = await db.users.get_user_by_email(data.email)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    password_hash = Hasher.hash_password(data.password)
    user = await db.users.create_user({
        "email": data.email,
        "password_hash": password_hash,
        "fullname": data.fullname,
        "native_language": data.native_language,
        "target_language": data.target_language,
        "interests": data.interests,
        "bio": data.bio,
    })

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: Database = Depends(Database.get_db)):
    user = await db.users.get_user_by_email(data.email)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid email or password")

    if not Hasher.verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: Database = Depends(Database.get_db)):
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    user_id = _get_user_id(payload)
    user = await db.users.get_user_by_id(user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)
