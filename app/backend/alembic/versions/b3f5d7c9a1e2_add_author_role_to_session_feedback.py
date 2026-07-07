"""add author role to session feedback

Revision ID: b3f5d7c9a1e2
Revises: a76cd5ec1af5
Create Date: 2026-07-06 13:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3f5d7c9a1e2"
down_revision: Union[str, Sequence[str], None] = "a76cd5ec1af5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "session_feedback",
        sa.Column(
            "author_role",
            sa.String(),
            nullable=False,
            server_default="helper",
        ),
    )

    op.alter_column(
        "session_feedback",
        "author_role",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("session_feedback", "author_role")