from backend.models.base import Base
from datetime import datetime
from typing import Optional
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)
    fullname: Mapped[str] = mapped_column(nullable=False)
    native_language: Mapped[Optional[str]] = mapped_column(nullable=True, index=True)
    target_language: Mapped[Optional[str]] = mapped_column(nullable=True, index=True)
    interests: Mapped[Optional[list[str]]] = mapped_column(JSONB, default=list)
    bio: Mapped[Optional[str]]
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.now)
