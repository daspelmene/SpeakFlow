from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

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
    room = await db.rooms.get_room_by_id(data.room_id)

    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")

    target_user = await db.users.get_user_by_id(data.target_user_id)

    if target_user is None:
        raise HTTPException(status_code=404, detail="Target user not found")

    if not room.is_invited_accepted:
        raise HTTPException(
            status_code=403,
            detail="Room is not active",
        )

    if user.id not in (room.user_creator_id, room.invited_user_id):
        raise HTTPException(status_code=403, detail="Not a participant of this room")

    if data.target_user_id not in (room.user_creator_id, room.invited_user_id):
        raise HTTPException(
            status_code=400,
            detail="Target user is not a participant of this room",
        )

    return await db.session_feedback.create_feedback(
        {
            "room_id": data.room_id,
            "author_id": user.id,
            "target_user_id": data.target_user_id,
            "author_role": data.author_role,
            "feedback": data.feedback,
        }
    )



@router.get(
    "",
    response_model=list[SessionFeedbackResponse],
)
async def get_feedback(
    scope: Literal["received", "authored"] = "received",
    db: Database = Depends(Database.get_db),
    user: User = Depends(get_current_user),
):
    if scope == "authored":
        return await db.session_feedback.get_feedback_by_author(user.id)

    return await db.session_feedback.get_feedback_by_target_user(user.id)
