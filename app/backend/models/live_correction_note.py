from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey

from models.base import Base


class LiveCorrectionNote(Base):
    __tablename__ = "live_correction_notes"

    id: Mapped[int] = mapped_column(primary_key=True)

    room_id: Mapped[str] = mapped_column(index=True)

    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    note_text: Mapped[str]

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

