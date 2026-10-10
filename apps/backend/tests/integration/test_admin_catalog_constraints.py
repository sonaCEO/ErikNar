import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.catalog.admin_schemas import (
    CreateBodyColorCommand,
    CreateControlTypeCommand,
    CreatePanelColorCommand,
    CreateProductCommand,
    CreateVariantCommand,
)
from eriknar.catalog.admin_service import AdminCatalogService, CatalogConflictError
from eriknar.catalog.enums import AvailabilityStatus


@pytest.mark.anyio
async def test_variant_requires_existing_references_and_unique_sku(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        service = AdminCatalogService(session)
        product = await service.create_product(
            CreateProductCommand(
                slug="slim",
                name="Slim",
                model_code="C",
                category="rail",
                short_description="Slim",
                description="Slim model",
                max_temperature=60,
                heater_type="dry",
                warranty_months=24,
            )
        )
        body = await service.create_body_color(
            CreateBodyColorCommand(slug="chrome", name="Хром", hex_value="#cccccc")
        )
        panel = await service.create_panel_color(
            CreatePanelColorCommand(slug="black", name="Чёрный")
        )
        control = await service.create_control_type(
            CreateControlTypeCommand(slug="touch", name="Touch", description="Display")
        )
        command = CreateVariantCommand(
            product_id=product.id,
            sku="ER-C-1",
            width_mm=180,
            height_mm=1200,
            body_color_id=body.id,
            panel_color_id=panel.id,
            control_type_id=control.id,
            price_minor=1_200_000,
            availability_status=AvailabilityStatus.IN_STOCK,
        )
        await service.create_variant(command)
        with pytest.raises(CatalogConflictError):
            await service.create_variant(command)

    await engine.dispose()
