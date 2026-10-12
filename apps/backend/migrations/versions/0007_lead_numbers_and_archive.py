"""Add sequential public lead numbers.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE lead_number_seq")
    op.execute("ALTER TABLE leads ADD COLUMN number BIGINT")
    op.execute(
        """
        WITH ordered AS (
            SELECT id, row_number() OVER (ORDER BY created_at, id) AS number
            FROM leads
        )
        UPDATE leads
        SET number = ordered.number
        FROM ordered
        WHERE leads.id = ordered.id
        """
    )
    op.execute(
        """
        SELECT setval(
            'lead_number_seq',
            COALESCE((SELECT max(number) + 1 FROM leads), 1),
            false
        )
        """
    )
    op.execute("ALTER TABLE leads ALTER COLUMN number SET DEFAULT nextval('lead_number_seq')")
    op.execute("ALTER TABLE leads ALTER COLUMN number SET NOT NULL")
    op.create_index("ix_leads_number", "leads", ["number"], unique=True)
    op.execute("ALTER TABLE leads ADD COLUMN telegram_archive_message_id BIGINT")
    op.execute("ALTER TABLE leads ADD COLUMN telegram_archived_at TIMESTAMPTZ")
    op.execute(
        """
        CREATE UNIQUE INDEX uq_outbox_lead_archive_due
        ON outbox_events (aggregate_id)
        WHERE event_type = 'lead.archive_due'
        """
    )


def downgrade() -> None:
    op.drop_index("uq_outbox_lead_archive_due", table_name="outbox_events")
    op.drop_column("leads", "telegram_archived_at")
    op.drop_column("leads", "telegram_archive_message_id")
    op.drop_index("ix_leads_number", table_name="leads")
    op.drop_column("leads", "number")
    op.execute("DROP SEQUENCE lead_number_seq")
