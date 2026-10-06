"""delivery hardening

Revision ID: 0004
Revises: 0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("leads", sa.Column("customer_name", sa.String(length=120), nullable=True))
    op.add_column("leads", sa.Column("customer_phone", sa.String(length=40), nullable=True))
    op.execute(
        """
        UPDATE leads
        SET customer_name = customers.name,
            customer_phone = customers.phone_original
        FROM customers
        WHERE customers.id = leads.customer_id
        """
    )
    op.alter_column("leads", "customer_name", nullable=False)
    op.alter_column("leads", "customer_phone", nullable=False)
    op.add_column(
        "outbox_events",
        sa.Column("requires_review", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("outbox_events", "requires_review")
    op.drop_column("leads", "customer_phone")
    op.drop_column("leads", "customer_name")
