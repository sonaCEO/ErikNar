import asyncio
import contextlib
import logging

from aiogram import Bot, Dispatcher

from eriknar.core.config import get_settings
from eriknar.db.session import engine, session_factory
from eriknar.outbox.processor import OutboxProcessor
from eriknar.telegram.client import AiogramTelegramGateway
from eriknar.telegram.handlers import build_router

logger = logging.getLogger("eriknar.telegram.worker")


async def _process_outbox(processor: OutboxProcessor, interval: float) -> None:
    while True:
        try:
            processed = await processor.run_once()
        except Exception:
            logger.exception("outbox_iteration_failed")
            await asyncio.sleep(interval)
            continue
        if not processed:
            await asyncio.sleep(interval)


async def run() -> None:
    settings = get_settings()
    if not settings.telegram_bot_token or settings.telegram_manager_chat_id is None:
        raise RuntimeError("Telegram bot token and manager chat ID are required")

    bot = Bot(settings.telegram_bot_token)
    dispatcher = Dispatcher()
    dispatcher.include_router(build_router(session_factory))
    processor = OutboxProcessor(
        session_factory,
        AiogramTelegramGateway(bot, settings.telegram_manager_chat_id),
        max_attempts=settings.telegram_outbox_max_attempts,
    )
    outbox_task = asyncio.create_task(
        _process_outbox(processor, settings.telegram_outbox_poll_seconds)
    )
    try:
        await dispatcher.start_polling(bot)
    finally:
        outbox_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await outbox_task
        await bot.session.close()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
