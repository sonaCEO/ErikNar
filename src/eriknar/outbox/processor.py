from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from eriknar.leads.models import Lead
from eriknar.outbox.models import OutboxEvent, OutboxStatus
from eriknar.outbox.repository import OutboxRepository
from eriknar.telegram.client import TelegramGateway
from eriknar.telegram.formatters import format_lead_card


class OutboxProcessor:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        gateway: TelegramGateway,
        *,
        max_attempts: int = 8,
        max_backoff_seconds: int = 300,
        processing_timeout_seconds: int = 300,
    ) -> None:
        self._session_factory = session_factory
        self._gateway = gateway
        self._max_attempts = max_attempts
        self._max_backoff_seconds = max_backoff_seconds
        self._processing_timeout_seconds = processing_timeout_seconds

    async def _claim(self) -> UUID | None:
        async with self._session_factory() as session, session.begin():
            return await OutboxRepository(session).claim_next(self._processing_timeout_seconds)

    async def _load_lead(self, event_id: UUID) -> Lead:
        async with self._session_factory() as session:
            event = await session.get(OutboxEvent, event_id)
            if event is None or event.event_type != "lead.created":
                raise LookupError("unsupported outbox event")
            lead = await session.scalar(
                select(Lead)
                .where(Lead.id == event.aggregate_id)
                .options(selectinload(Lead.customer))
            )
            if lead is None:
                raise LookupError("lead not found")
            return lead

    async def _save_topic(self, lead_id: UUID, topic_id: int) -> None:
        async with self._session_factory() as session, session.begin():
            lead = await session.get(Lead, lead_id, with_for_update=True)
            if lead is not None and lead.telegram_topic_id is None:
                lead.telegram_topic_id = topic_id

    async def _complete(self, event_id: UUID, lead_id: UUID, message_id: int) -> None:
        async with self._session_factory() as session, session.begin():
            lead = await session.get(Lead, lead_id, with_for_update=True)
            event = await session.get(OutboxEvent, event_id, with_for_update=True)
            if lead is None or event is None:
                raise LookupError("delivery state not found")
            if lead.telegram_message_id is None:
                lead.telegram_message_id = message_id
            event.status = OutboxStatus.COMPLETED
            event.processing_started_at = None
            event.completed_at = datetime.now(UTC)
            event.last_error = None

    async def _fail(self, event_id: UUID, error: Exception) -> None:
        async with self._session_factory() as session, session.begin():
            event = await session.get(OutboxEvent, event_id, with_for_update=True)
            if event is None:
                return
            event.last_error = str(error)[:2000]
            event.processing_started_at = None
            if event.attempt_count >= self._max_attempts:
                event.status = OutboxStatus.FAILED
                event.next_attempt_at = None
                return
            delay = min(2 ** max(event.attempt_count - 1, 0), self._max_backoff_seconds)
            event.status = OutboxStatus.PENDING
            event.next_attempt_at = datetime.now(UTC) + timedelta(seconds=delay)

    async def run_once(self) -> bool:
        event_id = await self._claim()
        if event_id is None:
            return False
        try:
            lead = await self._load_lead(event_id)
            if lead.telegram_topic_id is None:
                topic_id = await self._gateway.create_forum_topic(
                    f"Заявка {str(lead.public_id)[:8]}"
                )
                await self._save_topic(lead.id, topic_id)
                lead.telegram_topic_id = topic_id
            if lead.telegram_message_id is None:
                text = format_lead_card(
                    public_id=str(lead.public_id),
                    customer_name=lead.customer.name,
                    phone=lead.customer.phone_original,
                    snapshot=lead.snapshot,
                    comment=lead.comment,
                )
                message_id = await self._gateway.send_lead_card(
                    lead.telegram_topic_id,
                    text,
                    f"lead:claim:{lead.id}",
                )
                await self._complete(event_id, lead.id, message_id)
            else:
                await self._complete(event_id, lead.id, lead.telegram_message_id)
        except Exception as exc:
            await self._fail(event_id, exc)
        return True
