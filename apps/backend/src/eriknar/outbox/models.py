from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from eriknar.db.base import Base
from eriknar.db.types import TimestampMixin, UUIDPrimaryKeyMixin


class OutboxStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class OutboxEvent(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "outbox_events"

    event_type: Mapped[str] = mapped_column(String(100), index=True)
    aggregate_type: Mapped[str] = mapped_column(String(100))
    aggregate_id: Mapped[UUID]
    payload: Mapped[dict[str, object]] = mapped_column(JSONB)
    status: Mapped[OutboxStatus] = mapped_column(
        Enum(
            OutboxStatus,
            name="outbox_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=OutboxStatus.PENDING,
        server_default=OutboxStatus.PENDING.value,
        index=True,
    )
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    processing_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    requires_review: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
