from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.outbox.models import OutboxEvent, OutboxStatus
from eriknar.outbox.processor import OutboxProcessor
from eriknar.telegram.client import TelegramGateway
from tests.factories import seed_lead_with_event


class TemporarilyFailingGateway(TelegramGateway):
    async def create_forum_topic(self, name: str) -> int:
        raise ConnectionError("Telegram unavailable")

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int:
        raise AssertionError("card must not be sent")


class WorkingGateway(TelegramGateway):
    async def create_forum_topic(self, name: str) -> int:
        return 701

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int:
        return 901


@pytest.mark.anyio
async def test_temporary_failure_schedules_bounded_retry(migrated_postgres_url: str) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    _, event_id = await seed_lead_with_event(factory, idempotency_key="retry")

    before = datetime.now(UTC)
    processor = OutboxProcessor(factory, TemporarilyFailingGateway(), max_attempts=1)
    assert await processor.run_once() is True

    async with factory() as session:
        event = await session.scalar(select(OutboxEvent).where(OutboxEvent.id == event_id))
        assert event is not None
        assert event.status == OutboxStatus.PENDING
        assert event.attempt_count == 1
        assert event.next_attempt_at is not None
        assert before < event.next_attempt_at
        assert (event.next_attempt_at - before).total_seconds() <= 60
        assert "Telegram unavailable" in (event.last_error or "")
    await engine.dispose()


class TopicPersistenceFailureProcessor(OutboxProcessor):
    async def _save_topic(self, event_id: UUID, lead_id: UUID, topic_id: int) -> None:
        raise RuntimeError("database commit failed after Telegram success")


@pytest.mark.anyio
async def test_uncertain_external_success_requires_manual_review(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    _, event_id = await seed_lead_with_event(factory, idempotency_key="uncertain")

    processor = TopicPersistenceFailureProcessor(factory, WorkingGateway())
    assert await processor.run_once() is True

    async with factory() as session:
        event = await session.get(OutboxEvent, event_id)
        assert event is not None
        assert event.status == OutboxStatus.FAILED
        assert event.requires_review is True
        assert event.next_attempt_at is None
    await engine.dispose()


@pytest.mark.anyio
async def test_abandoned_processing_event_is_recovered(migrated_postgres_url: str) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    _, event_id = await seed_lead_with_event(factory, idempotency_key="abandoned")
    async with factory() as session:
        event = await session.get(OutboxEvent, event_id)
        assert event is not None
        event.status = OutboxStatus.PROCESSING
        event.processing_started_at = datetime.now(UTC) - timedelta(minutes=10)
        await session.commit()

    processor = OutboxProcessor(factory, WorkingGateway(), processing_timeout_seconds=60)
    assert await processor.run_once() is True

    async with factory() as session:
        event = await session.get(OutboxEvent, event_id)
        assert event is not None
        assert event.status == OutboxStatus.COMPLETED
    await engine.dispose()
