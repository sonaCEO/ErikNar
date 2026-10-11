"""Ensure one primary image per media scope.

Revision ID: 0006
Revises: 0005
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX uq_product_media_primary_scope
        ON product_media (product_id, variant_id, body_color_id) NULLS NOT DISTINCT
        WHERE is_primary
        """
    )


def downgrade() -> None:
    op.drop_index("uq_product_media_primary_scope", table_name="product_media")
