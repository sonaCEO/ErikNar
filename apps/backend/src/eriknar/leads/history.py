from uuid import UUID

from sqlalchemy import Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from eriknar.db.base import Base
from eriknar.db.types import TimestampMixin, UUIDPrimaryKeyMixin
from eriknar.leads.enums import LeadStatus


class LeadHistory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "lead_history"

    lead_id: Mapped[UUID] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    actor_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(40))
    previous_status: Mapped[LeadStatus | None] = mapped_column(
        Enum(
            LeadStatus,
            name="lead_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=True,
    )
    new_status: Mapped[LeadStatus | None] = mapped_column(
        Enum(
            LeadStatus,
            name="lead_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=True,
    )
    previous_assignee_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True))
    new_assignee_id: Mapped[UUID | None] = mapped_column(Uuid(as_uuid=True))
    comment: Mapped[str] = mapped_column(Text, default="", server_default="")
