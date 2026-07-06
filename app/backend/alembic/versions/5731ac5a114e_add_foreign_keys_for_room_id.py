"""add foreign keys for room id

Revision ID: 5731ac5a114e
Revises: a76cd5ec1af5
Create Date: 2026-07-03 18:41:13.509414

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5731ac5a114e'
down_revision: Union[str, Sequence[str], None] = 'a76cd5ec1af5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('live_correction_notes', 'room_id')
    op.add_column('live_correction_notes', sa.Column('room_id', sa.UUID(), nullable=False))
    op.create_foreign_key(None, 'live_correction_notes', 'rooms', ['room_id'], ['room_id'], ondelete='CASCADE')
    op.alter_column('rooms', 'is_invited_accepted',
               existing_type=sa.BOOLEAN(),
               server_default=None,
               existing_nullable=False)
    op.drop_column('session_feedback', 'room_id')
    op.add_column('session_feedback', sa.Column('room_id', sa.UUID(), nullable=False))
    op.create_foreign_key(None, 'session_feedback', 'rooms', ['room_id'], ['room_id'], ondelete='CASCADE')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(None, 'session_feedback', type_='foreignkey')
    op.drop_column('session_feedback', 'room_id')
    op.add_column('session_feedback', sa.Column('room_id', sa.VARCHAR(), nullable=False))
    op.alter_column('rooms', 'is_invited_accepted',
               existing_type=sa.BOOLEAN(),
               server_default=sa.text('false'),
               existing_nullable=False)
    op.drop_constraint(None, 'live_correction_notes', type_='foreignkey')
    op.drop_column('live_correction_notes', 'room_id')
    op.add_column('live_correction_notes', sa.Column('room_id', sa.VARCHAR(), nullable=False))
