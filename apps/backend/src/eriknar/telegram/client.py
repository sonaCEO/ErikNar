from typing import Protocol

from aiogram import Bot
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramNetworkError, TelegramRetryAfter, TelegramServerError
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from eriknar.leads.enums import LeadStatus


def lead_keyboard(lead_id: str, status: LeadStatus) -> InlineKeyboardMarkup | None:
    if status == LeadStatus.NEW:
        rows = [
            [InlineKeyboardButton(text="Взять в работу", callback_data=f"lead:claim:{lead_id}")]
        ]
    elif status == LeadStatus.IN_PROGRESS:
        rows = [
            [
                InlineKeyboardButton(
                    text="Завершить", callback_data=f"lead:complete:{lead_id}"
                ),
                InlineKeyboardButton(text="Отклонить", callback_data=f"lead:reject:{lead_id}"),
            ]
        ]
    else:
        return None
    return InlineKeyboardMarkup(inline_keyboard=rows)


class TelegramTopicGateway(Protocol):
    async def rename_topic(self, topic_id: int, name: str) -> None: ...


class TelegramGateway(TelegramTopicGateway, Protocol):
    async def create_forum_topic(self, name: str) -> int: ...

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int: ...

    async def send_archive_card(self, text: str) -> int: ...

    async def close_topic(self, topic_id: int) -> None: ...


class TransientTelegramError(ConnectionError):
    pass


class AiogramTelegramGateway:
    def __init__(
        self,
        bot: Bot,
        manager_chat_id: int,
        archive_topic_id: int | None = None,
    ) -> None:
        self._bot = bot
        self._manager_chat_id = manager_chat_id
        self._archive_topic_id = archive_topic_id

    async def create_forum_topic(self, name: str) -> int:
        try:
            topic = await self._bot.create_forum_topic(chat_id=self._manager_chat_id, name=name)
        except (TelegramNetworkError, TelegramRetryAfter, TelegramServerError) as exc:
            raise TransientTelegramError(str(exc)) from exc
        return topic.message_thread_id

    async def rename_topic(self, topic_id: int, name: str) -> None:
        try:
            await self._bot.edit_forum_topic(
                chat_id=self._manager_chat_id,
                message_thread_id=topic_id,
                name=name,
            )
        except (TelegramNetworkError, TelegramRetryAfter, TelegramServerError) as exc:
            raise TransientTelegramError(str(exc)) from exc

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int:
        lead_id = callback_data.rsplit(":", 1)[-1]
        keyboard = lead_keyboard(lead_id, LeadStatus.NEW)
        try:
            message = await self._bot.send_message(
                chat_id=self._manager_chat_id,
                message_thread_id=topic_id,
                text=text,
                parse_mode=ParseMode.HTML,
                reply_markup=keyboard,
            )
        except (TelegramNetworkError, TelegramRetryAfter, TelegramServerError) as exc:
            raise TransientTelegramError(str(exc)) from exc
        return message.message_id

    async def send_archive_card(self, text: str) -> int:
        if self._archive_topic_id is None:
            raise RuntimeError("Telegram archive topic ID is not configured")
        try:
            message = await self._bot.send_message(
                chat_id=self._manager_chat_id,
                message_thread_id=self._archive_topic_id,
                text=text,
                parse_mode=ParseMode.HTML,
            )
        except (TelegramNetworkError, TelegramRetryAfter, TelegramServerError) as exc:
            raise TransientTelegramError(str(exc)) from exc
        return message.message_id

    async def close_topic(self, topic_id: int) -> None:
        try:
            await self._bot.close_forum_topic(
                chat_id=self._manager_chat_id,
                message_thread_id=topic_id,
            )
        except (TelegramNetworkError, TelegramRetryAfter, TelegramServerError) as exc:
            raise TransientTelegramError(str(exc)) from exc
