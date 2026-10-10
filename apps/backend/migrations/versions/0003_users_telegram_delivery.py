"""users and Telegram delivery state

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("telegram_user_id", sa.BigInteger(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_telegram_user_id"), "users", ["telegram_user_id"], unique=True)
    op.add_column("leads", sa.Column("assigned_to_user_id", sa.Uuid(), nullable=True))
    op.add_column("leads", sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("leads", sa.Column("telegram_topic_id", sa.BigInteger(), nullable=True))
    op.add_column("leads", sa.Column("telegram_message_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        op.f("fk_leads_assigned_to_user_id_users"),
        "leads",
        "users",
        ["assigned_to_user_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_leads_assigned_to_user_id_users"), "leads", type_="foreignkey")
    op.drop_column("leads", "telegram_message_id")
    op.drop_column("leads", "telegram_topic_id")
    op.drop_column("leads", "assigned_at")
    op.drop_column("leads", "assigned_to_user_id")
    op.drop_index(op.f("ix_users_telegram_user_id"), table_name="users")
    op.drop_table("users")
