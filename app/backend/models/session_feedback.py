from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey

from models.base import Base


class SessionFeedback(Base):
    __tablename__ = "session_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)

    room_id: Mapped[str] = mapped_column(index=True)

    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    target_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    feedback: Mapped[str]

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
