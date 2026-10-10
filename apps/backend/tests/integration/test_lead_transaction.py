from uuid import UUID

import pytest
from sqlalchemy import event, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant
from eriknar.customers.models import Customer
from eriknar.leads.enums import LeadSource
from eriknar.leads.models import Lead
from eriknar.leads.schemas import CreateLeadCommand
from eriknar.leads.service import LeadService
from eriknar.outbox.models import OutboxEvent


async def _seed_variant(session: AsyncSession) -> UUID:
    variant = ProductVariant(
        product=Product(
            slug="transaction-model",
            name="Лесенка",
            model_code="TX",
            category="heated_towel_rail",
            short_description="Описание",
            description="Полное описание",
            max_temperature=60,
            heater_type="Сухой ТЭН",
            warranty_months=24,
            is_published=True,
        ),
        sku="ER-TX",
        width_mm=500,
        height_mm=800,
        body_color=BodyColor(slug="tx-black", name="Чёрный TX", hex_value="#20201f"),
        panel_color=PanelColor(slug="tx-panel", name="Чёрная TX"),
        control_type=ControlType(slug="tx-touch", name="Сенсорная TX", description="Дисплей"),
        price_minor=1_260_000,
        currency="RUB",
        availability_status=AvailabilityStatus.IN_STOCK,
        is_active=True,
    )
    session.add(variant)
    await session.commit()
    return variant.id


@pytest.mark.anyio
async def test_outbox_failure_rolls_back_customer_and_lead(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        variant_id = await _seed_variant(session)

        def reject_outbox(sync_session: Session, flush_context: object, instances: object) -> None:
            del flush_context, instances
            if any(isinstance(item, OutboxEvent) for item in sync_session.new):
                raise RuntimeError("simulated outbox failure")

        event.listen(session.sync_session, "before_flush", reject_outbox)
        with pytest.raises(RuntimeError, match="simulated outbox failure"):
            await LeadService(session).create(
                CreateLeadCommand(
                    variant_id=variant_id,
                    customer_name="Анна",
                    phone="+7 999 000-00-00",
                    comment="",
                    source=LeadSource.WEBSITE,
                ),
                "rollback-request",
            )
        event.remove(session.sync_session, "before_flush", reject_outbox)

        assert await session.scalar(select(func.count()).select_from(Customer)) == 0
        assert await session.scalar(select(func.count()).select_from(Lead)) == 0
        assert await session.scalar(select(func.count()).select_from(OutboxEvent)) == 0

    await engine.dispose()
