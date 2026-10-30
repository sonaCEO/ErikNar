"""Allow leads with no specific product variant (consultation/custom requests).

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("leads", "variant_id", nullable=True)
    op.alter_column("leads", "snapshot", nullable=True)


def downgrade() -> None:
    op.alter_column("leads", "snapshot", nullable=False)
    op.alter_column("leads", "variant_id", nullable=False)
