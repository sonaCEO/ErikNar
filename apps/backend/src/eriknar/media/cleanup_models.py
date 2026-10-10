from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from eriknar.db.base import Base
from eriknar.db.types import TimestampMixin, UUIDPrimaryKeyMixin


class PendingMediaDeletion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pending_media_deletions"
    __table_args__ = (UniqueConstraint("bucket", "object_key", name="uq_pending_media_object"),)

    bucket: Mapped[str] = mapped_column(String(120))
    object_key: Mapped[str] = mapped_column(String(500))
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_error: Mapped[str | None] = mapped_column(Text)
