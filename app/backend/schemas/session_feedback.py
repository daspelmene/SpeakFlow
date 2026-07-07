from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CreateSessionFeedbackRequest(BaseModel):
    room_id: UUID
    target_user_id: int
    feedback: str
    author_role: Literal["helper", "learner"] = "helper"


class SessionFeedbackResponse(BaseModel):
    id: int
    room_id: UUID
    author_id: int
    target_user_id: int
    author_role: str
    feedback: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)