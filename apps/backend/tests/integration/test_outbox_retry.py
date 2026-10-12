from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from eriknar.leads.enums import LeadStatus
from eriknar.leads.models import Lead
from eriknar.outbox.models import OutboxEvent, OutboxStatus
from eriknar.outbox.processor import OutboxProcessor
from eriknar.telegram.client import TelegramGateway
from tests.factories import seed_lead_with_event


class TemporarilyFailingGateway(TelegramGateway):
    async def rename_topic(self, topic_id: int, name: str) -> None:
        raise AssertionError("outbox delivery must not rename topics")

    async def create_forum_topic(self, name: str) -> int:
        raise ConnectionError("Telegram unavailable")

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int:
        raise AssertionError("card must not be sent")

    async def send_archive_card(self, text: str) -> int:
        raise AssertionError("archive card must not be sent")

    async def close_topic(self, topic_id: int) -> None:
        raise AssertionError("topic must not be closed")


class WorkingGateway(TelegramGateway):
    def __init__(self) -> None:
        self.archive_cards: list[str] = []
        self.closed_topics: list[int] = []

    async def rename_topic(self, topic_id: int, name: str) -> None:
        raise AssertionError("outbox delivery must not rename topics")

    async def create_forum_topic(self, name: str) -> int:
        return 701

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int:
        return 901

    async def send_archive_card(self, text: str) -> int:
        self.archive_cards.append(text)
        return 902

    async def close_topic(self, topic_id: int) -> None:
        self.closed_topics.append(topic_id)


async def _seed_archive_event(
    factory: async_sessionmaker[AsyncSession],
    *,
    due: bool,
    archive_message_id: int | None = None,
) -> tuple[UUID, UUID]:
    lead_id, _ = await seed_lead_with_event(
        factory,
        idempotency_key=f"archive-{due}-{archive_message_id}",
    )
    async with factory() as session:
        await session.execute(delete(OutboxEvent))
        lead = await session.get(Lead, lead_id)
        assert lead is not None
        now = datetime.now(UTC)
        lead.status = LeadStatus.COMPLETED
        lead.closed_at = now - timedelta(days=2)
        lead.telegram_topic_id = 701
        lead.telegram_archive_message_id = archive_message_id
        event = OutboxEvent(
            event_type="lead.archive_due",
            aggregate_type="lead",
            aggregate_id=lead_id,
            payload={"lead_id": str(lead_id)},
            next_attempt_at=now - timedelta(seconds=1) if due else now + timedelta(hours=1),
        )
        session.add(event)
        await session.commit()
        return lead_id, event.id


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


@pytest.mark.anyio
async def test_archive_event_waits_until_due_then_posts_once_and_closes_topic(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    lead_id, _ = await _seed_archive_event(factory, due=False)
    gateway = WorkingGateway()
    processor = OutboxProcessor(factory, gateway)

    assert await processor.run_once() is False
    async with factory() as session:
        event = await session.scalar(select(OutboxEvent))
        assert event is not None
        event.next_attempt_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()

    assert await processor.run_once() is True
    assert await processor.run_once() is False
    assert len(gateway.archive_cards) == 1
    assert "№" in gateway.archive_cards[0]
    assert gateway.closed_topics == [701]
    async with factory() as session:
        lead = await session.get(Lead, lead_id)
        assert lead is not None
        assert lead.telegram_archive_message_id == 902
        assert lead.telegram_archived_at is not None
    await engine.dispose()


@pytest.mark.anyio
async def test_archive_retry_with_saved_message_does_not_post_duplicate(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    lead_id, _ = await _seed_archive_event(factory, due=True, archive_message_id=777)
    gateway = WorkingGateway()

    assert await OutboxProcessor(factory, gateway).run_once() is True

    assert gateway.archive_cards == []
    assert gateway.closed_topics == [701]
    async with factory() as session:
        lead = await session.get(Lead, lead_id)
        assert lead is not None and lead.telegram_archived_at is not None
    await engine.dispose()


class ArchivePersistenceFailureProcessor(OutboxProcessor):
    async def _save_archive_message(
        self, event_id: UUID, lead_id: UUID, message_id: int
    ) -> None:
        raise RuntimeError("database commit failed after archive post")


@pytest.mark.anyio
async def test_archive_post_with_ambiguous_persistence_requires_review(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    _, event_id = await _seed_archive_event(factory, due=True)
    gateway = WorkingGateway()
    processor = ArchivePersistenceFailureProcessor(factory, gateway)

    assert await processor.run_once() is True
    assert gateway.archive_cards
    assert gateway.closed_topics == []
    assert await processor.run_once() is False
    async with factory() as session:
        event = await session.get(OutboxEvent, event_id)
        assert event is not None
        assert event.status == OutboxStatus.FAILED
        assert event.requires_review is True
        assert event.next_attempt_at is None
    await engine.dispose()
