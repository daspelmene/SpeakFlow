from fastapi import APIRouter, Depends, HTTPException
from handlers.routes.audio import ws_audio_service as audio_service

from models.user import User
from schemas.session_feedback import (
    CreateSessionFeedbackRequest,
    SessionFeedbackResponse,
)
from storage.database import Database
from utils.jwt import get_current_user

router = APIRouter(
    prefix="/feedback",
    tags=["Session Feedback"],
)


@router.post(
    "/create",
    response_model=SessionFeedbackResponse,
)
async def create_feedback(
    data: CreateSessionFeedbackRequest,
    db: Database = Depends(Database.get_db),
    user: User = Depends(get_current_user),
):
    if data.room_id not in audio_service.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    target = await db.users.get_user_by_id(data.target_user_id)
    if not target:
        raise HTTPException(404, "Target user not found")
    
    return await db.session_feedback.create_feedback(
        {
            "room_id": data.room_id,
            "author_id": user.id,
            "target_user_id": data.target_user_id,
            "feedback": data.feedback,
        }
    )


@router.get(
    "",
    response_model=list[SessionFeedbackResponse],
)
async def get_feedback(
    db: Database = Depends(Database.get_db),
    user: User = Depends(get_current_user),
):
    items = await db.session_feedback.get_feedback_by_user(user.id)

    return [SessionFeedbackResponse(feedback=i.feedback) for i in items]
