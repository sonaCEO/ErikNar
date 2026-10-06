from datetime import timedelta

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.catalog.admin_schemas import CreateProductCommand, UpdateProductCommand
from eriknar.catalog.admin_service import AdminCatalogService, ConcurrentUpdateError


def _create_product() -> CreateProductCommand:
    return CreateProductCommand(
        slug="lesenka",
        name="Лесенка",
        model_code="B",
        category="heated_towel_rail",
        short_description="Кратко",
        description="Полное описание",
        max_temperature=60,
        heater_type="Сухой ТЭН",
        warranty_months=24,
        sort_order=2,
        is_published=False,
    )


@pytest.mark.anyio
async def test_create_update_and_archive_product(migrated_postgres_url: str) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        service = AdminCatalogService(session)
        created = await service.create_product(_create_product())
        updated = await service.update_product(
            created.id,
            UpdateProductCommand(
                expected_updated_at=created.updated_at,
                name="Лесенка Premium",
                is_published=True,
            ),
        )
        archived = await service.archive_product(updated.id, updated.updated_at)

    assert created.sort_order == 2
    assert updated.name == "Лесенка Premium"
    assert updated.is_published is True
    assert archived.archived_at is not None
    assert archived.is_published is False
    await engine.dispose()


@pytest.mark.anyio
async def test_stale_product_update_is_rejected(migrated_postgres_url: str) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        service = AdminCatalogService(session)
        created = await service.create_product(_create_product())
        with pytest.raises(ConcurrentUpdateError):
            await service.update_product(
                created.id,
                UpdateProductCommand(
                    expected_updated_at=created.updated_at - timedelta(seconds=1),
                    name="Устаревшее изменение",
                ),
            )
    await engine.dispose()
