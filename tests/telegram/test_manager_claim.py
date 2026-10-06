import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.leads.enums import LeadStatus
from eriknar.leads.models import Lead
from eriknar.leads.service import LeadService
from eriknar.telegram.handlers import ManagerActionService, UnauthorizedManagerError
from eriknar.users.models import User
from tests.factories import seed_lead_with_event


@pytest.mark.anyio
async def test_two_managers_cannot_claim_the_same_lead(migrated_postgres_url: str) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    lead_id, _ = await seed_lead_with_event(factory, idempotency_key="claim")
    async with factory() as session:
        first_user = User(name="Мария", telegram_user_id=1001)
        second_user = User(name="Ольга", telegram_user_id=1002)
        session.add_all([first_user, second_user])
        await session.commit()

    async with factory() as first_session, factory() as second_session:
        first, second = await asyncio.gather(
            LeadService(first_session).claim(lead_id, first_user.id),
            LeadService(second_session).claim(lead_id, second_user.id),
        )

    assert sorted([first.claimed, second.claimed]) == [False, True]
    winner = first_user.id if first.claimed else second_user.id
    assert first.assigned_to_user_id == winner
    assert second.assigned_to_user_id == winner
    async with factory() as session:
        lead = await session.get(Lead, lead_id)
        assert lead is not None
        assert lead.assigned_to_user_id == winner
        assert lead.status == LeadStatus.IN_PROGRESS
        assert lead.assigned_at is not None
    await engine.dispose()


@pytest.mark.anyio
async def test_manager_action_reports_when_another_manager_already_claimed(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    lead_id, _ = await seed_lead_with_event(factory, idempotency_key="claim-feedback")
    async with factory() as session:
        first = User(name="Мария", telegram_user_id=3001)
        second = User(name="Ольга", telegram_user_id=3002)
        session.add_all([first, second])
        await session.commit()
    actions = ManagerActionService(factory)

    winner = await actions.perform("claim", lead_id, first.telegram_user_id)
    loser = await actions.perform("claim", lead_id, second.telegram_user_id)

    assert winner.claimed is True
    assert loser.claimed is False
    assert loser.assigned_to_user_id == first.id
    assert loser.assigned_to_name == "Мария"
    await engine.dispose()


@pytest.mark.anyio
async def test_only_active_assignee_can_complete_lead(migrated_postgres_url: str) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    lead_id, _ = await seed_lead_with_event(factory, idempotency_key="transitions")
    async with factory() as session:
        manager = User(name="Мария", telegram_user_id=2001)
        inactive = User(name="Ольга", telegram_user_id=2002, is_active=False)
        session.add_all([manager, inactive])
        await session.commit()

    actions = ManagerActionService(factory)
    with pytest.raises(UnauthorizedManagerError):
        await actions.perform("claim", lead_id, inactive.telegram_user_id)

    await actions.perform("claim", lead_id, manager.telegram_user_id)
    completed = await actions.perform("complete", lead_id, manager.telegram_user_id)

    assert completed.status == LeadStatus.COMPLETED
    async with factory() as session:
        lead = await session.get(Lead, lead_id)
        assert lead is not None
        assert lead.status == LeadStatus.COMPLETED
        assert lead.closed_at is not None
    await engine.dispose()
