"""add is_finished to rooms

Revision ID: d4e6f7a8b9c0
Revises: c9f1a2b3d4e5
Create Date: 2026-07-06 23:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c9f1a2b3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "rooms",
        sa.Column(
            "is_finished",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.alter_column(
        "rooms",
        "is_finished",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("rooms", "is_finished")