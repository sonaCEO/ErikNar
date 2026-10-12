from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from eriknar.leads.enums import LeadStatus
from eriknar.leads.schemas import LeadActionResult
from eriknar.telegram.client import AiogramTelegramGateway
from eriknar.telegram.handlers import update_lead_presentation


class RecordingMessage:
    def __init__(self) -> None:
        self.html_text = "<b>Новая заявка №0007</b>"
        self.edits: list[dict[str, Any]] = []

    async def edit_text(self, text: str, **kwargs: Any) -> None:
        self.edits.append({"text": text, **kwargs})


class RecordingTopicGateway:
    def __init__(self) -> None:
        self.renames: list[tuple[int, str]] = []

    async def rename_topic(self, topic_id: int, name: str) -> None:
        self.renames.append((topic_id, name))


def _result(status: LeadStatus, *, claimed: bool | None = None) -> LeadActionResult:
    return LeadActionResult(
        assigned_to_user_id=uuid4(),
        assigned_to_name="Сона",
        status=status,
        claimed=claimed,
        number=7,
        model_code="B",
        telegram_topic_id=701,
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("result", "expected_name", "has_keyboard"),
    [
        (
            _result(LeadStatus.IN_PROGRESS, claimed=True),
            "🟡 №0007 · В работе · Сона",  # noqa: RUF001
            True,
        ),
        (_result(LeadStatus.COMPLETED), "✅ №0007 · Завершена", False),
        (_result(LeadStatus.CANCELLED), "❌ №0007 · Отклонена", False),
    ],
)
async def test_manager_action_updates_card_and_topic_after_commit(
    result: LeadActionResult, expected_name: str, has_keyboard: bool
) -> None:
    message = RecordingMessage()
    gateway = RecordingTopicGateway()

    await update_lead_presentation(message, str(uuid4()), result, gateway)

    assert gateway.renames == [(701, expected_name)]
    assert len(message.edits) == 1
    assert (message.edits[0]["reply_markup"] is not None) is has_keyboard


@pytest.mark.anyio
async def test_rejected_transition_does_not_update_card_or_topic() -> None:
    message = RecordingMessage()
    gateway = RecordingTopicGateway()

    # Rejected transitions raise before this post-commit presentation step is called.
    assert message.edits == []
    assert gateway.renames == []


@pytest.mark.anyio
async def test_aiogram_gateway_renames_topic_in_manager_chat() -> None:
    bot = SimpleNamespace(edit_forum_topic=AsyncMock())
    gateway = AiogramTelegramGateway(bot, -100123)  # type: ignore[arg-type]

    await gateway.rename_topic(701, "✅ №0007 · Завершена")

    bot.edit_forum_topic.assert_awaited_once_with(
        chat_id=-100123,
        message_thread_id=701,
        name="✅ №0007 · Завершена",
    )
