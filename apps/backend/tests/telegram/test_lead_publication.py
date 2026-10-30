import asyncio

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.leads.enums import LeadStatus
from eriknar.leads.models import Lead
from eriknar.outbox.models import OutboxEvent, OutboxStatus
from eriknar.outbox.processor import OutboxProcessor
from eriknar.telegram.client import TelegramGateway, lead_keyboard
from eriknar.telegram.formatters import format_lead_card, format_lead_state, format_topic_name
from tests.factories import seed_lead_with_event


def test_lead_card_contains_snapshot_and_escapes_customer_text() -> None:
    message = format_lead_card(
        number=7,
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

    assert "№0007" in message
    assert "10000000-0000-4000-8000-000000000001" not in message
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


def test_lead_card_without_snapshot_shows_consultation_marker() -> None:
    message = format_lead_card(
        number=8,
        customer_name="Анна",
        phone="+7 999 000-00-00",
        snapshot=None,
        comment="Нужна консультация по подбору модели",
    )

    assert "№0008" in message
    assert "Консультация" in message
    assert "Модель" not in message


@pytest.mark.parametrize(
    ("status", "assignee_name", "expected"),
    [
        (LeadStatus.NEW, None, "🆕 №0007 · Новая · Модель B"),
        (LeadStatus.IN_PROGRESS, "Сона", "🟡 №0007 · В работе · Сона"),  # noqa: RUF001
        (LeadStatus.COMPLETED, "Сона", "✅ №0007 · Завершена"),
        (LeadStatus.CANCELLED, "Сона", "❌ №0007 · Отклонена"),
    ],
)
def test_topic_name_describes_lead_state(
    status: LeadStatus, assignee_name: str | None, expected: str
) -> None:
    assert format_topic_name(7, status, "B", assignee_name) == expected


def test_topic_name_marks_consultation_when_no_model_code() -> None:
    assert (
        format_topic_name(8, LeadStatus.NEW, None, None)
        == "🆕 №0008 · Новая · Консультация"
    )


def test_topic_name_truncates_only_long_assignee_to_telegram_limit() -> None:
    name = format_topic_name(7, LeadStatus.IN_PROGRESS, "B", "С" * 200)  # noqa: RUF001

    assert len(name) == 128
    assert name.startswith("🟡 №0007 · В работе · ")  # noqa: RUF001


def test_lead_keyboard_only_offers_actions_valid_for_current_status() -> None:
    lead_id = "10000000-0000-4000-8000-000000000001"

    new_keyboard = lead_keyboard(lead_id, LeadStatus.NEW)
    active_keyboard = lead_keyboard(lead_id, LeadStatus.IN_PROGRESS)

    assert new_keyboard is not None
    assert [button.text for row in new_keyboard.inline_keyboard for button in row] == [
        "Взять в работу"
    ]
    assert active_keyboard is not None
    assert [button.text for row in active_keyboard.inline_keyboard for button in row] == [
        "Завершить",
        "Отклонить",
    ]
    assert lead_keyboard(lead_id, LeadStatus.COMPLETED) is None
    assert lead_keyboard(lead_id, LeadStatus.CANCELLED) is None


def test_lead_state_replaces_previous_state_in_card() -> None:
    original = "<b>Новая заявка</b>\n\n<b>Клиент:</b> Анна"
    active = format_lead_state(original, LeadStatus.IN_PROGRESS, "Мария <менеджер>")
    completed = format_lead_state(active, LeadStatus.COMPLETED, "Мария <менеджер>")

    assert "🟡 В работе" in active  # noqa: RUF001
    assert "Мария &lt;менеджер&gt;" in active
    assert "✅ Завершена" in completed
    assert "🟡 В работе" not in completed  # noqa: RUF001
    assert completed.count("<b>Статус:</b>") == 1


class RecordingGateway(TelegramGateway):
    def __init__(self) -> None:
        self.topics: list[str] = []
        self.cards: list[tuple[int, str, str]] = []

    async def create_forum_topic(self, name: str) -> int:
        self.topics.append(name)
        return 700 + len(self.topics)

    async def rename_topic(self, topic_id: int, name: str) -> None:
        raise AssertionError("publishing a new lead must not rename its topic")

    async def send_archive_card(self, text: str) -> int:
        raise AssertionError("publishing a new lead must not archive it")

    async def close_topic(self, topic_id: int) -> None:
        raise AssertionError("publishing a new lead must not close its topic")

    async def edit_lead_card(
        self,
        topic_id: int,
        message_id: int,
        text: str,
        lead_id: str,
        status: LeadStatus,
    ) -> None:
        raise AssertionError("publishing a new lead must not edit its card")

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
