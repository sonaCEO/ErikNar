from sqlalchemy import func, select
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

    async def list_published(self, *, page: int, page_size: int) -> list[Product]:
        statement = (
            select(Product)
            .where(Product.is_published.is_(True), Product.archived_at.is_(None))
            .order_by(Product.sort_order, Product.name, Product.id)
            .options(*_catalog_load_options())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list((await self._session.scalars(statement)).unique())

    async def count_published(self) -> int:
        statement = select(func.count()).select_from(Product).where(
            Product.is_published.is_(True), Product.archived_at.is_(None)
        )
        return await self._session.scalar(statement) or 0
