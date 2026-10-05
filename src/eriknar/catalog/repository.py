from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.base import ExecutableOption

from eriknar.catalog.models import Product, ProductVariant


def _catalog_load_options() -> tuple[ExecutableOption, ...]:
    return (
        selectinload(Product.variants).selectinload(ProductVariant.body_color),
        selectinload(Product.variants).selectinload(ProductVariant.panel_color),
        selectinload(Product.variants).selectinload(ProductVariant.control_type),
        selectinload(Product.variants).selectinload(ProductVariant.media),
        selectinload(Product.media),
    )


class CatalogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_published_by_slug(self, slug: str) -> Product | None:
        statement = (
            select(Product)
            .where(
                Product.slug == slug,
                Product.is_published.is_(True),
                Product.archived_at.is_(None),
            )
            .options(*_catalog_load_options())
        )
        return await self._session.scalar(statement)

    async def list_published(self) -> list[Product]:
        statement = (
            select(Product)
            .where(Product.is_published.is_(True), Product.archived_at.is_(None))
            .order_by(Product.name)
            .options(*_catalog_load_options())
        )
        return list((await self._session.scalars(statement)).unique())
