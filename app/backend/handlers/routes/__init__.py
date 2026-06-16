from fastapi import APIRouter

v1_router = APIRouter(prefix="/api/v1")

from app.backend.handlers.routes.auth import router as auth_router
from app.backend.handlers.routes.user import router as user_router

v1_router.include_router(auth_router)
v1_router.include_router(user_router)
