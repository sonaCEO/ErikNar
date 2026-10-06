from typing import Protocol

from aiogram import Bot
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramNetworkError, TelegramRetryAfter, TelegramServerError
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


class TelegramGateway(Protocol):
    async def create_forum_topic(self, name: str) -> int: ...

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int: ...


class TransientTelegramError(ConnectionError):
    pass


class AiogramTelegramGateway:
    def __init__(self, bot: Bot, manager_chat_id: int) -> None:
        self._bot = bot
        self._manager_chat_id = manager_chat_id

    async def create_forum_topic(self, name: str) -> int:
        try:
            topic = await self._bot.create_forum_topic(chat_id=self._manager_chat_id, name=name)
        except (TelegramNetworkError, TelegramRetryAfter, TelegramServerError) as exc:
            raise TransientTelegramError(str(exc)) from exc
        return topic.message_thread_id

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int:
        lead_id = callback_data.rsplit(":", 1)[-1]
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="Взять в работу", callback_data=callback_data)],
                [
                    InlineKeyboardButton(
                        text="Завершить", callback_data=f"lead:complete:{lead_id}"
                    ),
                    InlineKeyboardButton(text="Отклонить", callback_data=f"lead:reject:{lead_id}"),
                ],
            ]
        )
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
