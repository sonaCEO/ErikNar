from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.media.cleanup_models import PendingMediaDeletion
from eriknar.media.cleanup_processor import MediaCleanupProcessor


class FlakyObjectStorage:
    def __init__(self) -> None:
        self.should_fail = True
        self.deleted: list[tuple[str, str]] = []

    async def put(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        raise NotImplementedError

    async def delete(self, bucket: str, key: str) -> None:
        if self.should_fail:
            raise OSError("storage unavailable")
        self.deleted.append((bucket, key))

    def public_url(self, bucket: str, key: str) -> str:
        return f"/{bucket}/{key}"


@pytest.mark.anyio
async def test_cleanup_retries_failed_object_deletion(migrated_postgres_url: str) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session, session.begin():
        pending = PendingMediaDeletion(bucket="product-media", object_key="products/old.webp")
        session.add(pending)

    storage = FlakyObjectStorage()
    processor = MediaCleanupProcessor(factory, storage)
    now = datetime.now(UTC)

    assert await processor.run_once(now=now) is True
    async with factory() as session:
        failed = await session.get(PendingMediaDeletion, pending.id)
        assert failed is not None
        assert failed.attempt_count == 1
        assert failed.last_error == "storage unavailable"

    storage.should_fail = False
    assert await processor.run_once(now=now + timedelta(hours=1)) is True
    async with factory() as session:
        assert await session.get(PendingMediaDeletion, pending.id) is None
    assert storage.deleted == [("product-media", "products/old.webp")]

    await engine.dispose()
