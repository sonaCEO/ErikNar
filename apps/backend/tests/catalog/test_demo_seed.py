import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.catalog.demo_seed import seed_demo_catalog
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant


@pytest.mark.anyio
async def test_demo_seed_is_idempotent_and_preserves_edited_price(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    first = await seed_demo_catalog(factory)

    assert first.products_created == 4
    assert first.variants_created == 192

    async with factory() as session, session.begin():
        variant = await session.scalar(select(ProductVariant).order_by(ProductVariant.sku).limit(1))
        assert variant is not None
        variant.price_minor = 999_999
        edited_sku = variant.sku

    second = await seed_demo_catalog(factory)

    assert second.total_created == 0
    async with factory() as session:
        counts = {
            "products": await session.scalar(select(func.count()).select_from(Product)),
            "variants": await session.scalar(select(func.count()).select_from(ProductVariant)),
            "body_colors": await session.scalar(select(func.count()).select_from(BodyColor)),
            "panel_colors": await session.scalar(select(func.count()).select_from(PanelColor)),
            "control_types": await session.scalar(select(func.count()).select_from(ControlType)),
        }
        edited_price = await session.scalar(
            select(ProductVariant.price_minor).where(ProductVariant.sku == edited_sku)
        )

    assert counts == {
        "products": 4,
        "variants": 192,
        "body_colors": 6,
        "panel_colors": 2,
        "control_types": 2,
    }
    assert edited_price == 999_999
    await engine.dispose()
