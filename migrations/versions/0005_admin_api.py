"""administrative API data model

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _replace_lead_status(*, old_label: str, new_label: str) -> None:
    op.execute("ALTER TYPE lead_status RENAME TO lead_status_old")
    op.execute(
        f"CREATE TYPE lead_status AS ENUM ('new', 'in_progress', 'completed', '{new_label}')"
    )
    op.execute("ALTER TABLE leads ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE leads ALTER COLUMN status TYPE lead_status "
        f"USING (CASE WHEN status::text = '{old_label}' THEN '{new_label}' "
        "ELSE status::text END)::lead_status"
    )
    op.execute("ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'new'::lead_status")
    op.execute("DROP TYPE lead_status_old")


def upgrade() -> None:
    user_role = sa.Enum("admin", "manager", name="user_role")
    user_role.create(op.get_bind(), checkfirst=True)

    op.add_column("users", sa.Column("login", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=500), nullable=True))
    op.add_column(
        "users",
        sa.Column("role", user_role, server_default="manager", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), server_default="0", nullable=False),
    )
    op.execute("UPDATE users SET login = 'telegram-' || id::text, password_hash = '!'")
    op.alter_column("users", "login", nullable=False)
    op.alter_column("users", "password_hash", nullable=False)
    op.alter_column("users", "telegram_user_id", nullable=True)
    op.create_index(op.f("ix_users_login"), "users", ["login"], unique=True)

    op.add_column(
        "products", sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False)
    )

    _replace_lead_status(old_label="rejected", new_label="cancelled")
    op.create_index("ix_leads_status_created_at", "leads", ["status", "created_at"])
    op.create_index(
        "ix_leads_assigned_status_created_at",
        "leads",
        ["assigned_to_user_id", "status", "created_at"],
    )

    op.create_table(
        "lead_history",
        sa.Column("lead_id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("previous_status", sa.Enum(name="lead_status", create_type=False), nullable=True),
        sa.Column("new_status", sa.Enum(name="lead_status", create_type=False), nullable=True),
        sa.Column("previous_assignee_id", sa.Uuid(), nullable=True),
        sa.Column("new_assignee_id", sa.Uuid(), nullable=True),
        sa.Column("comment", sa.Text(), server_default="", nullable=False),
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
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lead_history_actor_user_id"), "lead_history", ["actor_user_id"])
    op.create_index(op.f("ix_lead_history_lead_id"), "lead_history", ["lead_id"])

    op.create_table(
        "auth_login_attempts",
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("failure_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("blocked_until", sa.DateTime(timezone=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_auth_login_attempts_blocked_until"),
        "auth_login_attempts",
        ["blocked_until"],
    )
    op.create_index(
        op.f("ix_auth_login_attempts_fingerprint"),
        "auth_login_attempts",
        ["fingerprint"],
        unique=True,
    )

    op.create_table(
        "pending_media_deletions",
        sa.Column("bucket", sa.String(length=120), nullable=False),
        sa.Column("object_key", sa.String(length=500), nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bucket", "object_key", name="uq_pending_media_object"),
    )
    op.create_index(
        op.f("ix_pending_media_deletions_next_attempt_at"),
        "pending_media_deletions",
        ["next_attempt_at"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_pending_media_deletions_next_attempt_at"),
        table_name="pending_media_deletions",
    )
    op.drop_table("pending_media_deletions")
    op.drop_index(op.f("ix_auth_login_attempts_fingerprint"), table_name="auth_login_attempts")
    op.drop_index(op.f("ix_auth_login_attempts_blocked_until"), table_name="auth_login_attempts")
    op.drop_table("auth_login_attempts")
    op.drop_index(op.f("ix_lead_history_lead_id"), table_name="lead_history")
    op.drop_index(op.f("ix_lead_history_actor_user_id"), table_name="lead_history")
    op.drop_table("lead_history")
    op.drop_index("ix_leads_assigned_status_created_at", table_name="leads")
    op.drop_index("ix_leads_status_created_at", table_name="leads")
    _replace_lead_status(old_label="cancelled", new_label="rejected")
    op.drop_column("products", "sort_order")
    op.drop_index(op.f("ix_users_login"), table_name="users")
    op.drop_column("users", "token_version")
    op.drop_column("users", "role")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "login")
    op.alter_column("users", "telegram_user_id", nullable=False)
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
