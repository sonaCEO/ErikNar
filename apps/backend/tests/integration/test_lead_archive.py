from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.leads.admin_schemas import ChangeLeadStatusCommand
from eriknar.leads.admin_service import AdminLeadService
from eriknar.leads.enums import LeadStatus
from eriknar.leads.models import Lead
from eriknar.leads.service import LeadService, schedule_lead_archive
from eriknar.outbox.models import OutboxEvent
from eriknar.users.enums import UserRole
from eriknar.users.models import User
from tests.factories import seed_lead_with_event


@pytest.mark.anyio
async def test_telegram_terminal_transition_schedules_one_archive_event(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    lead_id, _ = await seed_lead_with_event(factory, idempotency_key="telegram-archive")
    async with factory() as session:
        manager = User(name="Сона", login="sona", password_hash="!", telegram_user_id=1001)
        session.add(manager)
        await session.commit()
        await LeadService(session).claim(lead_id, manager.id)
        await LeadService(session).resolve(lead_id, manager.id, LeadStatus.COMPLETED)

    async with factory() as session:
        lead = await session.get(Lead, lead_id)
        event = await session.scalar(
            select(OutboxEvent).where(OutboxEvent.event_type == "lead.archive_due")
        )
        assert lead is not None and lead.closed_at is not None
        assert event is not None
        assert event.aggregate_id == lead_id
        assert event.next_attempt_at == lead.closed_at + timedelta(hours=24)
        assert (
            await session.scalar(
                select(func.count())
                .select_from(OutboxEvent)
                .where(OutboxEvent.event_type == "lead.archive_due")
            )
            == 1
        )
        async with session.begin_nested():
            await schedule_lead_archive(session, lead)
        assert (
            await session.scalar(
                select(func.count())
                .select_from(OutboxEvent)
                .where(OutboxEvent.event_type == "lead.archive_due")
            )
            == 1
        )
    await engine.dispose()


@pytest.mark.anyio
async def test_admin_terminal_transition_schedules_archive_event(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    lead_id, _ = await seed_lead_with_event(factory, idempotency_key="admin-archive")
    async with factory() as session:
        admin = User(
            name="Владелец",
            login="admin-archive",
            password_hash="!",
            role=UserRole.ADMIN,
        )
        session.add(admin)
        await session.commit()
        lead = await session.get(Lead, lead_id)
        assert lead is not None
        expected_updated_at = lead.updated_at
    async with factory() as session:
        await AdminLeadService(session).change_status(
            lead_id,
            ChangeLeadStatusCommand(
                expected_updated_at=expected_updated_at,
                status=LeadStatus.CANCELLED,
            ),
            admin,
        )

    async with factory() as session:
        lead = await session.get(Lead, lead_id)
        event = await session.scalar(
            select(OutboxEvent).where(OutboxEvent.event_type == "lead.archive_due")
        )
        assert lead is not None and lead.closed_at is not None
        assert event is not None
        assert event.next_attempt_at == lead.closed_at + timedelta(hours=24)
    await engine.dispose()
