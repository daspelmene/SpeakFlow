"""init

Revision ID: 870c45e6192c
Revises:
Create Date: 2026-06-14 20:50:01.870239

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "870c45e6192c"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("fullname", sa.String(), nullable=False),
        sa.Column("native_language", sa.String(), nullable=False, index=True),
        sa.Column("target_language", sa.String(), nullable=False, index=True),
        sa.Column("interests", JSONB(), nullable=True),
        sa.Column("bio", sa.String(), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("email"),
    )


def downgrade() -> None:
    op.drop_table("users")
