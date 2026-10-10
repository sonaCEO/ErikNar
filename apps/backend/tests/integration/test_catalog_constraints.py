import os
import subprocess
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant


@pytest.fixture
def migrated_postgres_url(postgres_url: str) -> str:
    subprocess.run(
        ["uv", "run", "alembic", "upgrade", "head"],
        check=True,
        env={**os.environ, "ERIKNAR_DATABASE_URL": postgres_url},
        capture_output=True,
        text=True,
    )
    return postgres_url


async def _session(database_url: str) -> tuple[AsyncSession, AsyncEngine]:
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    return factory(), engine


def _product(slug: str, model_code: str) -> Product:
    return Product(
        slug=slug,
        name=f"Модель {model_code}",
        model_code=model_code,
        category="heated_towel_rail",
        short_description="Описание",
        description="Полное описание",
        max_temperature=60,
        heater_type="Сухой ТЭН",
        warranty_months=24,
        is_published=True,
    )


@pytest.mark.anyio
async def test_database_rejects_duplicate_product_slug(migrated_postgres_url: str) -> None:
    session, engine = await _session(migrated_postgres_url)
    async with session:
        session.add_all([_product("lesenka", "B1"), _product("lesenka", "B2")])
        with pytest.raises(IntegrityError):
            await session.commit()
    await engine.dispose()


@pytest.mark.anyio
async def test_database_rejects_duplicate_variant_sku(migrated_postgres_url: str) -> None:
    session, engine = await _session(migrated_postgres_url)
    async with session:
        product = _product("lesenka", "B")
        body = BodyColor(slug="black", name="Чёрный", hex_value="#20201f")
        panel = PanelColor(slug="panel-black", name="Чёрная панель")
        control = ControlType(slug="touch", name="Сенсорная", description="Дисплей")
        session.add_all([product, body, panel, control])
        await session.flush()
        session.add_all(
            [
                ProductVariant(
                    sku="ER-DUPLICATE",
                    product=product,
                    width_mm=400,
                    height_mm=800,
                    body_color=body,
                    panel_color=panel,
                    control_type=control,
                    price_minor=1_200_000,
                    availability_status=AvailabilityStatus.IN_STOCK,
                ),
                ProductVariant(
                    sku="ER-DUPLICATE",
                    product=product,
                    width_mm=500,
                    height_mm=800,
                    body_color=body,
                    panel_color=panel,
                    control_type=control,
                    price_minor=1_300_000,
                    availability_status=AvailabilityStatus.IN_STOCK,
                ),
            ]
        )
        with pytest.raises(IntegrityError):
            await session.commit()
    await engine.dispose()


@pytest.mark.anyio
async def test_database_rejects_duplicate_variant_configuration(
    migrated_postgres_url: str,
) -> None:
    session, engine = await _session(migrated_postgres_url)
    async with session:
        product = _product("lesenka", "B")
        body = BodyColor(slug="black", name="Чёрный", hex_value="#20201f")
        panel = PanelColor(slug="panel-black", name="Чёрная панель")
        control = ControlType(slug="touch", name="Сенсорная", description="Дисплей")
        session.add_all([product, body, panel, control])
        await session.flush()
        common = {
            "product_id": product.id,
            "width_mm": 500,
            "height_mm": 800,
            "body_color_id": body.id,
            "panel_color_id": panel.id,
            "control_type_id": control.id,
            "price_minor": 1_300_000,
            "availability_status": AvailabilityStatus.IN_STOCK,
        }
        session.add_all(
            [
                ProductVariant(id=uuid4(), sku="ER-B-1", **common),
                ProductVariant(id=uuid4(), sku="ER-B-2", **common),
            ]
        )
        with pytest.raises(IntegrityError):
            await session.commit()
    await engine.dispose()


@pytest.mark.anyio
async def test_migration_downgrade_removes_custom_enums(
    migrated_postgres_url: str,
) -> None:
    subprocess.run(
        ["uv", "run", "alembic", "downgrade", "base"],
        check=True,
        env={**os.environ, "ERIKNAR_DATABASE_URL": migrated_postgres_url},
        capture_output=True,
        text=True,
    )
    engine = create_async_engine(migrated_postgres_url)
    async with engine.connect() as connection:
        remaining_enums = await connection.scalars(
            text(
                "SELECT typname FROM pg_type WHERE typname IN "
                "('availability_status', 'lead_source', 'lead_status', 'outbox_status')"
            )
        )

    assert list(remaining_enums) == []
    await engine.dispose()
