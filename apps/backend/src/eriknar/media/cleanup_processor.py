from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from eriknar.media.cleanup_models import PendingMediaDeletion
from eriknar.media.storage import ObjectStorage


class MediaCleanupProcessor:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        storage: ObjectStorage,
    ) -> None:
        self._session_factory = session_factory
        self._storage = storage

    async def run_once(self, *, now: datetime | None = None) -> bool:
        current_time = now or datetime.now(UTC)
        async with self._session_factory() as session, session.begin():
            pending = await session.scalar(
                select(PendingMediaDeletion)
                .where(
                    or_(
                        PendingMediaDeletion.next_attempt_at.is_(None),
                        PendingMediaDeletion.next_attempt_at <= current_time,
                    )
                )
                .order_by(PendingMediaDeletion.created_at, PendingMediaDeletion.id)
                .with_for_update(skip_locked=True)
                .limit(1)
            )
            if pending is None:
                return False

            try:
                await self._storage.delete(pending.bucket, pending.object_key)
            except Exception as exc:
                pending.attempt_count += 1
                delay_seconds = min(2 ** min(pending.attempt_count, 12), 3600)
                pending.next_attempt_at = current_time + timedelta(seconds=delay_seconds)
                pending.last_error = str(exc)[:2000]
            else:
                await session.delete(pending)
            return True
