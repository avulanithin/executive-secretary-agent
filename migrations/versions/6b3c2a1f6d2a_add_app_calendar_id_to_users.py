"""add app_calendar_id to users

Revision ID: 6b3c2a1f6d2a
Revises: d9e7485bf008
Create Date: 2026-02-22

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "6b3c2a1f6d2a"
down_revision = "d9e7485bf008"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("app_calendar_id", sa.String(length=255), nullable=True))


def downgrade():
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("app_calendar_id")
