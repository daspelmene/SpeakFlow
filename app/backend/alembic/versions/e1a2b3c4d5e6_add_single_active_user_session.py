"""add single active user session

Revision ID: e1a2b3c4d5e6
Revises: d4e6f7a8b9c0
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "d4e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("active_session_id", sa.String(), nullable=True))
    op.add_column(
        "users", sa.Column("active_session_expires_at", sa.DateTime(), nullable=True)
    )
    op.create_index(
        op.f("ix_users_active_session_id"), "users", ["active_session_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_active_session_id"), table_name="users")
    op.drop_column("users", "active_session_expires_at")
    op.drop_column("users", "active_session_id")
