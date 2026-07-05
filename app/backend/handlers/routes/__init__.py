from fastapi import APIRouter
from handlers.routes.auth import router as auth_router
from handlers.routes.user import router as user_router
from handlers.routes.audio import router as audio_router

from handlers.routes.session_template import router as session_template_router
from handlers.routes.live_correction_note import router as live_correction_note_router
from handlers.routes.session_feedback import router as session_feedback_router

v1_router = APIRouter(prefix="/api/v1")

v1_router.include_router(auth_router)
v1_router.include_router(user_router)
v1_router.include_router(audio_router)
v1_router.include_router(session_template_router)
v1_router.include_router(live_correction_note_router)
v1_router.include_router(session_feedback_router)
