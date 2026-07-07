from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

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

    if room.is_finished:
        raise HTTPException(
            status_code=403,
            detail="Room has already finished",
        )

    if user.id not in (room.user_creator_id, room.invited_user_id):
        raise HTTPException(status_code=403, detail="Not a participant of this room")

    if data.target_user_id not in (room.user_creator_id, room.invited_user_id):
        raise HTTPException(
            status_code=400,
            detail="Target user is not a participant of this room",
        )

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
    scope: Literal["received", "authored"] = "received",
    db: Database = Depends(Database.get_db),
    user: User = Depends(get_current_user),
):
    if scope == "authored":
        return await db.live_correction_notes.get_notes_by_author(user.id)

    return await db.live_correction_notes.get_notes_by_target_user(user.id)


@router.get(
    "/rooms/{room_id}/mine",
    response_model=list[LiveCorrectionNoteResponse],
)
async def get_my_notes_in_room(
    room_id: UUID,
    db: Database = Depends(Database.get_db),
    user: User = Depends(get_current_user),
):
    room = await db.rooms.get_room_by_id(room_id)

    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")

    if not room.is_invited_accepted:
        raise HTTPException(
            status_code=403,
            detail="Room is not active",
        )

    if user.id not in (room.user_creator_id, room.invited_user_id):
        raise HTTPException(status_code=403, detail="Not a participant of this room")

    return await db.live_correction_notes.get_notes_by_author_and_room(
        room_id=room_id,
        author_id=user.id,
    )