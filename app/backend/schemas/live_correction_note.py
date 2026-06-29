from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CreateLiveCorrectionNoteRequest(BaseModel):
    room_id: str
    target_user_id: int
    note_text: str


class LiveCorrectionNoteResponse(BaseModel):
    id: int
    room_id: str
    author_id: int
    target_user_id: int
    note_text: str
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )  # enables Pydantic ORM object parsing
