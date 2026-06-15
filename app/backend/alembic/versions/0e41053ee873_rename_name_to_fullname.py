"""rename_name_to_fullname

Revision ID: 0e41053ee873
Revises: 870c45e6192c
Create Date: 2026-06-14 21:16:33.853935

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e41053ee873'
down_revision: Union[str, Sequence[str], None] = '870c45e6192c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('users', 'name', new_column_name='fullname')


def downgrade() -> None:
    op.alter_column('users', 'fullname', new_column_name='name')
