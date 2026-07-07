import uuid

from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Room(Base):
    __tablename__ = "rooms"

    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_creator_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    invited_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    is_invited_accepted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    is_finished: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )