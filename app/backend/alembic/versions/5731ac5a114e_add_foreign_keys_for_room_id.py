"""add foreign keys for room id

Revision ID: 5731ac5a114e
Revises: a76cd5ec1af5
Create Date: 2026-07-03 18:41:13.509414

This migration converts room_id from VARCHAR to UUID and adds foreign keys
to the rooms table. It preserves existing data by creating missing rooms
if necessary, using an existing user or a temporary system user if none exist.
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
    """
    Upgrade schema:
    - Ensure at least one user exists for room creation.
    - Create missing rooms for room_id values present in child tables.
    - Convert room_id columns to UUID using casting.
    - Add foreign key constraints with CASCADE delete.
    - Adjust rooms.is_invited_accepted default.
    """

    # 1. Ensure there is at least one user in the 'users' table.
    #    If no user exists, insert a temporary system user.
    op.execute("""
        DO $$
        DECLARE
            user_exists boolean;
        BEGIN
            SELECT EXISTS (SELECT 1 FROM users LIMIT 1) INTO user_exists;
            IF NOT user_exists THEN
                INSERT INTO users (
                    email,
                    password_hash,
                    fullname,
                    native_language,
                    target_language,
                    is_active,
                    created_at,
                    updated_at
                ) VALUES (
                    'system_' || gen_random_uuid() || '@speakflow.com',
                    'dummy_hash',
                    'System User',
                    NULL,
                    NULL,
                    true,
                    now(),
                    now()
                );
            END IF;
        END $$;
    """)

    # 2. Create missing rooms for all distinct room_id values found in
    #    live_correction_notes and session_feedback.
    #    Use the first existing user as both creator and invited user.
    op.execute("""
        INSERT INTO rooms (room_id, user_creator_id, invited_user_id, is_invited_accepted)
        SELECT DISTINCT
            lcn.room_id::uuid,
            (SELECT id FROM users ORDER BY id LIMIT 1),
            (SELECT id FROM users ORDER BY id LIMIT 1),
            false
        FROM live_correction_notes lcn
        WHERE NOT EXISTS (
            SELECT 1 FROM rooms r WHERE r.room_id = lcn.room_id::uuid
        )
    """)

    op.execute("""
        INSERT INTO rooms (room_id, user_creator_id, invited_user_id, is_invited_accepted)
        SELECT DISTINCT
            sf.room_id::uuid,
            (SELECT id FROM users ORDER BY id LIMIT 1),
            (SELECT id FROM users ORDER BY id LIMIT 1),
            false
        FROM session_feedback sf
        WHERE NOT EXISTS (
            SELECT 1 FROM rooms r WHERE r.room_id = sf.room_id::uuid
        )
    """)

    # 3. Convert room_id columns from VARCHAR to UUID using explicit cast.
    op.execute('ALTER TABLE live_correction_notes ALTER COLUMN room_id TYPE UUID USING room_id::uuid')
    op.execute('ALTER TABLE session_feedback ALTER COLUMN room_id TYPE UUID USING room_id::uuid')

    # 4. Add foreign key constraints referencing rooms.room_id.
    op.create_foreign_key(
        None,
        'live_correction_notes',
        'rooms',
        ['room_id'],
        ['room_id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        None,
        'session_feedback',
        'rooms',
        ['room_id'],
        ['room_id'],
        ondelete='CASCADE'
    )

    # 5. Adjust rooms.is_invited_accepted column (remove server_default).
    op.alter_column(
        'rooms',
        'is_invited_accepted',
        existing_type=sa.BOOLEAN(),
        server_default=None,
        existing_nullable=False
    )


def downgrade() -> None:
    """
    Downgrade schema:
    - Drop foreign key constraints.
    - Revert room_id columns back to VARCHAR.
    - Restore server_default for rooms.is_invited_accepted.
    - (Created rooms are left intact; they can be removed manually if needed.)
    """

    # Drop foreign keys
    op.drop_constraint(None, 'session_feedback', type_='foreignkey')
    op.drop_constraint(None, 'live_correction_notes', type_='foreignkey')

    # Revert column types to VARCHAR
    op.execute('ALTER TABLE session_feedback ALTER COLUMN room_id TYPE VARCHAR USING room_id::text')
    op.execute('ALTER TABLE live_correction_notes ALTER COLUMN room_id TYPE VARCHAR USING room_id::text')

    # Restore server_default for rooms.is_invited_accepted
    op.alter_column(
        'rooms',
        'is_invited_accepted',
        existing_type=sa.BOOLEAN(),
        server_default=sa.text('false'),
        existing_nullable=False
    )
