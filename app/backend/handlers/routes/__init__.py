from fastapi import APIRouter
from backend.handlers.routes.auth import router as auth_router
from backend.handlers.routes.user import router as user_router
from backend.handlers.routes.audio import router as audio_router


v1_router = APIRouter(prefix="/api/v1")


v1_router.include_router(auth_router)
v1_router.include_router(user_router)
v1_router.include_router(audio_router)
