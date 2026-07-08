from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CreateLiveCorrectionNoteRequest(BaseModel):
    room_id: UUID
    target_user_id: int
    note_text: str


class LiveCorrectionNoteResponse(BaseModel):
    id: int
    room_id: UUID
    author_id: int
    target_user_id: int
    note_text: str
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )  # enables Pydantic ORM object parsing
