import asyncio

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.leads.models import Lead
from eriknar.outbox.models import OutboxEvent, OutboxStatus
from eriknar.outbox.processor import OutboxProcessor
from eriknar.telegram.client import TelegramGateway
from eriknar.telegram.formatters import format_lead_card
from tests.factories import seed_lead_with_event


def test_lead_card_contains_snapshot_and_escapes_customer_text() -> None:
    message = format_lead_card(
        public_id="10000000-0000-4000-8000-000000000001",
        customer_name="Анна <важно>",
        phone="+7 999 000-00-00",
        snapshot={
            "product_name": "Лесенка & Комфорт",
            "sku": "ER-B-800-500",
            "width_mm": 500,
            "height_mm": 800,
            "body_color": {"name": "Чёрный матовый"},
            "panel_color": {"name": "Белая"},
            "control_type": {"name": "Сенсорная"},
            "price_minor": 1_260_000,
            "currency": "RUB",
        },
        comment="Позвонить после 18:00 & уточнить",
    )

    assert "10000000-0000-4000-8000-000000000001" in message
    assert "Анна &lt;важно&gt;" in message
    assert "+7 999 000-00-00" in message
    assert "Лесенка &amp; Комфорт" in message
    assert "ER-B-800-500" in message
    assert "800 × 500 мм" in message  # noqa: RUF001
    assert "Чёрный матовый" in message
    assert "Белая" in message
    assert "Сенсорная" in message
    assert "12 600 ₽" in message
    assert "Позвонить после 18:00 &amp; уточнить" in message


class RecordingGateway(TelegramGateway):
    def __init__(self) -> None:
        self.topics: list[str] = []
        self.cards: list[tuple[int, str, str]] = []

    async def create_forum_topic(self, name: str) -> int:
        self.topics.append(name)
        return 700 + len(self.topics)

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int:
        self.cards.append((topic_id, text, callback_data))
        return 900 + len(self.cards)


@pytest.mark.anyio
async def test_processing_same_event_twice_publishes_one_topic_and_card(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    lead_id, _ = await seed_lead_with_event(factory)
    gateway = RecordingGateway()
    processor = OutboxProcessor(factory, gateway)

    first, second = await asyncio.gather(processor.run_once(), processor.run_once())
    assert sorted([first, second]) == [False, True]
    assert await processor.run_once() is False

    async with factory() as session:
        lead = await session.get(Lead, lead_id)
        event = await session.scalar(select(OutboxEvent))
        assert lead is not None
        assert event is not None
        assert lead.telegram_topic_id == 701
        assert lead.telegram_message_id == 901
        assert event.status == OutboxStatus.COMPLETED
        assert await session.scalar(select(func.count()).select_from(OutboxEvent)) == 1
    assert len(gateway.topics) == 1
    assert len(gateway.cards) == 1
    await engine.dispose()
