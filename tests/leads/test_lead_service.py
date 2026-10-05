import asyncio
from uuid import UUID

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant
from eriknar.leads.enums import LeadSource
from eriknar.leads.models import Lead
from eriknar.leads.schemas import CreateLeadCommand
from eriknar.leads.service import IdempotencyConflictError, LeadService, VariantUnavailableError
from eriknar.outbox.models import OutboxEvent


async def _session(database_url: str) -> tuple[AsyncSession, AsyncEngine]:
    engine = create_async_engine(database_url)
    return async_sessionmaker(engine, expire_on_commit=False)(), engine


async def _seed_variant(session: AsyncSession, availability: AvailabilityStatus) -> ProductVariant:
    product = Product(
        slug=f"lesenka-{availability.value}",
        name="Лесенка",
        model_code=f"B-{availability.value}",
        category="heated_towel_rail",
        short_description="Электрическая лесенка",
        description="Подробное описание",
        max_temperature=60,
        heater_type="Сухой ТЭН",
        warranty_months=24,
        is_published=True,
    )
    body = BodyColor(
        slug=f"black-{availability.value}",
        name=f"Чёрный {availability.value}",
        hex_value="#20201f",
    )
    panel = PanelColor(
        slug=f"panel-black-{availability.value}",
        name=f"Чёрная панель {availability.value}",
    )
    control = ControlType(
        slug=f"touch-{availability.value}",
        name=f"Сенсорная {availability.value}",
        description="Дисплей температуры и таймер",
    )
    variant = ProductVariant(
        product=product,
        sku=f"ER-B-{availability.value}",
        width_mm=500,
        height_mm=800,
        body_color=body,
        panel_color=panel,
        control_type=control,
        price_minor=1_260_000,
        currency="RUB",
        availability_status=availability,
        is_active=True,
    )
    session.add(variant)
    await session.commit()
    return variant


def _command(variant_id: UUID, *, comment: str = "Позвонить после 18:00") -> CreateLeadCommand:
    return CreateLeadCommand(
        variant_id=variant_id,
        customer_name="Анна",
        phone="8 (999) 000-00-00",
        comment=comment,
        source=LeadSource.WEBSITE,
    )


@pytest.mark.anyio
@pytest.mark.parametrize(
    "availability",
    [AvailabilityStatus.IN_STOCK, AvailabilityStatus.MADE_TO_ORDER],
)
async def test_create_lead_copies_complete_variant_snapshot(
    migrated_postgres_url: str, availability: AvailabilityStatus
) -> None:
    session, engine = await _session(migrated_postgres_url)
    async with session:
        variant = await _seed_variant(session, availability)

        result = await LeadService(session).create(_command(variant.id), "request-1")

        assert result.snapshot.product_name == "Лесенка"
        assert result.snapshot.sku == f"ER-B-{availability.value}"
        assert result.snapshot.width_mm == 500
        assert result.snapshot.height_mm == 800
        assert result.snapshot.body_color.name.startswith("Чёрный")
        assert result.snapshot.panel_color.name.startswith("Чёрная панель")
        assert result.snapshot.control_type.name.startswith("Сенсорная")
        assert result.snapshot.price_minor == 1_260_000
        assert result.snapshot.currency == "RUB"
    await engine.dispose()


@pytest.mark.anyio
@pytest.mark.parametrize(
    "availability",
    [AvailabilityStatus.HIDDEN, AvailabilityStatus.OUT_OF_STOCK],
)
async def test_create_lead_rejects_unavailable_variant(
    migrated_postgres_url: str, availability: AvailabilityStatus
) -> None:
    session, engine = await _session(migrated_postgres_url)
    async with session:
        variant = await _seed_variant(session, availability)

        with pytest.raises(VariantUnavailableError):
            await LeadService(session).create(_command(variant.id), "request-unavailable")

    await engine.dispose()


@pytest.mark.anyio
async def test_lead_snapshot_does_not_change_with_catalog_price(
    migrated_postgres_url: str,
) -> None:
    session, engine = await _session(migrated_postgres_url)
    async with session:
        variant = await _seed_variant(session, AvailabilityStatus.IN_STOCK)
        result = await LeadService(session).create(_command(variant.id), "request-price")
        variant.price_minor = 9_999_999
        await session.commit()
        session.expire_all()

        stored = await session.scalar(select(Lead).where(Lead.public_id == result.public_id))

        assert stored is not None
        assert stored.snapshot["price_minor"] == 1_260_000
    await engine.dispose()


@pytest.mark.anyio
async def test_same_idempotency_key_returns_original_lead_without_duplicates(
    migrated_postgres_url: str,
) -> None:
    session, engine = await _session(migrated_postgres_url)
    async with session:
        variant = await _seed_variant(session, AvailabilityStatus.IN_STOCK)
        service = LeadService(session)

        first = await service.create(_command(variant.id), "same-request")
        second = await service.create(_command(variant.id), "same-request")

        assert second.public_id == first.public_id
        assert await session.scalar(select(func.count()).select_from(Lead)) == 1
        assert await session.scalar(select(func.count()).select_from(OutboxEvent)) == 1
    await engine.dispose()


@pytest.mark.anyio
async def test_idempotency_key_reuse_with_different_payload_conflicts(
    migrated_postgres_url: str,
) -> None:
    session, engine = await _session(migrated_postgres_url)
    async with session:
        variant = await _seed_variant(session, AvailabilityStatus.IN_STOCK)
        service = LeadService(session)
        await service.create(_command(variant.id), "same-request")

        with pytest.raises(IdempotencyConflictError):
            await service.create(_command(variant.id, comment="Другой комментарий"), "same-request")

    await engine.dispose()


@pytest.mark.anyio
async def test_concurrent_same_idempotency_key_creates_one_lead(
    migrated_postgres_url: str,
) -> None:
    setup_session, engine = await _session(migrated_postgres_url)
    async with setup_session:
        variant = await _seed_variant(setup_session, AvailabilityStatus.IN_STOCK)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as first_session, factory() as second_session:
        first, second = await asyncio.gather(
            LeadService(first_session).create(_command(variant.id), "concurrent-request"),
            LeadService(second_session).create(_command(variant.id), "concurrent-request"),
        )

    async with factory() as verification_session:
        assert first.public_id == second.public_id
        assert await verification_session.scalar(select(func.count()).select_from(Lead)) == 1
        assert await verification_session.scalar(select(func.count()).select_from(OutboxEvent)) == 1
    await engine.dispose()
