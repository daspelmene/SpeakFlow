"""make native_language and target_language nullable

Revision ID: ae9bd76b4de6
Revises: 870c45e6192c
Create Date: 2026-06-21 10:40:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'ae9bd76b4de6'
down_revision: Union[str, Sequence[str], None] = '870c45e6192c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'native_language', nullable=True)
    op.alter_column('users', 'target_language', nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'native_language', nullable=False)
    op.alter_column('users', 'target_language', nullable=False)
