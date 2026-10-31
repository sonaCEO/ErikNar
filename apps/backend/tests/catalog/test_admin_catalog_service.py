from datetime import timedelta
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.catalog.admin_schemas import (
    CreateProductVariantInput,
    CreateProductWithVariantsCommand,
    ReferenceRefCommand,
    UpdateProductCommand,
)
from eriknar.catalog.admin_service import (
    AdminCatalogNotFoundError,
    AdminCatalogService,
    CatalogConflictError,
    ConcurrentUpdateError,
)


def _create_product() -> CreateProductWithVariantsCommand:
    return CreateProductWithVariantsCommand(
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


@pytest.mark.anyio
async def test_create_product_generates_slug_when_omitted(migrated_postgres_url: str) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        service = AdminCatalogService(session)
        command = _create_product()
        command.slug = None
        command.name = "Модель Люкс"

        created = await service.create_product(command)
        duplicate_name = _create_product()
        duplicate_name.slug = None
        duplicate_name.name = "Модель Люкс"
        duplicate_name.model_code = "LUX-2"
        second = await service.create_product(duplicate_name)

    assert created.slug == "model-lyuks"
    assert second.slug == "model-lyuks-2"
    await engine.dispose()


@pytest.mark.anyio
async def test_create_product_with_variants_resolves_and_creates_references_by_name(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        service = AdminCatalogService(session)
        command = _create_product()
        command.variants = [
            CreateProductVariantInput(
                sku="ER-B-800-500-BLACK-BUTTON",
                width_mm=500,
                height_mm=800,
                body_color=ReferenceRefCommand(name="Чёрный матовый", hex_value="#202020"),
                panel_color=ReferenceRefCommand(name="Чёрный"),
                control_type=ReferenceRefCommand(name="Кнопочное"),
                price_minor=1_260_000,
            ),
            CreateProductVariantInput(
                sku="ER-B-800-500-WHITE-BUTTON",
                width_mm=500,
                height_mm=800,
                body_color=ReferenceRefCommand(name="Белый"),
                panel_color=ReferenceRefCommand(name="Чёрный"),
                control_type=ReferenceRefCommand(name="Кнопочное"),
                price_minor=1_260_000,
            ),
        ]

        created = await service.create_product(command)

    assert len(created.variants) == 2
    assert {item.sku for item in created.variants} == {
        "ER-B-800-500-BLACK-BUTTON",
        "ER-B-800-500-WHITE-BUTTON",
    }
    # Both variants share "Чёрный" panel color and "Кнопочное" control type —
    # reused, not duplicated.
    assert created.variants[0].panel_color_id == created.variants[1].panel_color_id
    assert created.variants[0].control_type_id == created.variants[1].control_type_id
    await engine.dispose()


@pytest.mark.anyio
async def test_create_product_variant_rejects_unknown_reference_id(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        service = AdminCatalogService(session)
        command = _create_product()
        command.variants = [
            CreateProductVariantInput(
                sku="ER-B-800-500-UNKNOWN",
                width_mm=500,
                height_mm=800,
                body_color=ReferenceRefCommand(id=UUID(int=0)),
                panel_color=ReferenceRefCommand(name="Чёрный"),
                control_type=ReferenceRefCommand(name="Кнопочное"),
                price_minor=1_260_000,
            ),
        ]

        with pytest.raises(AdminCatalogNotFoundError):
            await service.create_product(command)
    await engine.dispose()


@pytest.mark.anyio
async def test_create_product_variant_rejects_duplicate_sku_in_same_request(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        service = AdminCatalogService(session)
        command = _create_product()
        duplicate_variant = CreateProductVariantInput(
            sku="ER-B-800-500-DUPLICATE",
            width_mm=500,
            height_mm=800,
            body_color=ReferenceRefCommand(name="Чёрный матовый", hex_value="#202020"),
            panel_color=ReferenceRefCommand(name="Чёрный"),
            control_type=ReferenceRefCommand(name="Кнопочное"),
            price_minor=1_260_000,
        )
        command.variants = [duplicate_variant, duplicate_variant]

        with pytest.raises(CatalogConflictError):
            await service.create_product(command)
    await engine.dispose()
