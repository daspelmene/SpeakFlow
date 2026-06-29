from pydantic import BaseModel, ConfigDict


class CreateSessionFeedbackRequest(BaseModel):
    room_id: str
    target_user_id: int
    feedback: str


class SessionFeedbackResponse(BaseModel):
    feedback: str

    model_config = ConfigDict(
        from_attributes=True
    )  # enables Pydantic ORM object parsing
