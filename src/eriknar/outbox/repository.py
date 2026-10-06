from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.outbox.models import OutboxEvent, OutboxStatus


class OutboxRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, event: OutboxEvent) -> None:
        self._session.add(event)

    async def claim_next(self, processing_timeout_seconds: int) -> UUID | None:
        now = datetime.now(UTC)
        stale_before = now - timedelta(seconds=processing_timeout_seconds)
        event = await self._session.scalar(
            select(OutboxEvent)
            .where(
                or_(
                    (
                        (OutboxEvent.status == OutboxStatus.PENDING)
                        & or_(
                            OutboxEvent.next_attempt_at.is_(None),
                            OutboxEvent.next_attempt_at <= now,
                        )
                    ),
                    (
                        (OutboxEvent.status == OutboxStatus.PROCESSING)
                        & (OutboxEvent.processing_started_at <= stale_before)
                    ),
                ),
            )
            .order_by(OutboxEvent.created_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if event is None:
            return None
        event.status = OutboxStatus.PROCESSING
        event.attempt_count += 1
        event.processing_started_at = now
        return event.id
