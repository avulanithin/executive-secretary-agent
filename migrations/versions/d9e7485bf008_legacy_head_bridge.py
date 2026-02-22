"""legacy head bridge

Revision ID: d9e7485bf008
Revises: 354633be6c21
Create Date: 2026-02-22

This is a no-op bridge revision.
The existing dev database is stamped with revision d9e7485bf008, but that
revision file was missing from the repository. Adding this file allows Alembic
upgrade/downgrade operations to proceed normally.

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "d9e7485bf008"
down_revision = "354633be6c21"
branch_labels = None
depends_on = None


def upgrade():
    # No-op bridge migration
    pass


def downgrade():
    # No-op bridge migration
    pass
