from fastapi import APIRouter, Depends, HTTPException
from handlers.routes.audio import ws_audio_service as audio_service

from models.user import User
from schemas.live_correction_note import (
    CreateLiveCorrectionNoteRequest,
    LiveCorrectionNoteResponse,
)
from storage.database import Database
from utils.jwt import get_current_user

router = APIRouter(
    prefix="/notes",
    tags=["Live Correction Notes"],
)


@router.post(
    "/create",
    response_model=LiveCorrectionNoteResponse,
)
async def create_note(
    data: CreateLiveCorrectionNoteRequest,
    db: Database = Depends(Database.get_db),
    user: User = Depends(get_current_user),
):
    if data.room_id not in audio_service.rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    target = await db.users.get_user_by_id(data.target_user_id)
    if not target:
        raise HTTPException(404, "Target user not found")
    
    return await db.live_correction_notes.create_note(
        {
            "room_id": data.room_id,
            "author_id": user.id,
            "target_user_id": data.target_user_id,
            "note_text": data.note_text,
        }
    )


@router.get(
    "",
    response_model=list[LiveCorrectionNoteResponse],
)
async def get_notes(
    db: Database = Depends(Database.get_db),
    user: User = Depends(get_current_user),
):
    return await db.live_correction_notes.get_notes_by_user(user.id)
