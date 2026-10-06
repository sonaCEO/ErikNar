from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.catalog.admin_schemas import (
    AdminProductView,
    AdminVariantView,
    BodyColorAdminView,
    ControlTypeAdminView,
    CreateBodyColorCommand,
    CreateControlTypeCommand,
    CreatePanelColorCommand,
    CreateProductCommand,
    CreateVariantCommand,
    ReferenceView,
    UpdateProductCommand,
    UpdateVariantCommand,
)
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant


class CatalogConflictError(ValueError):
    pass


class ConcurrentUpdateError(CatalogConflictError):
    pass


class AdminCatalogNotFoundError(ValueError):
    pass


class AdminCatalogService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_product(self, command: CreateProductCommand) -> AdminProductView:
        product = Product(**command.model_dump())
        await self._add(product)
        return AdminProductView.model_validate(product)

    async def update_product(
        self, product_id: UUID, command: UpdateProductCommand
    ) -> AdminProductView:
        values = command.model_dump(exclude={"expected_updated_at"}, exclude_none=True)
        values["updated_at"] = datetime.now(UTC)
        async with self._session.begin():
            product = await self._session.scalar(
                update(Product)
                .where(
                    Product.id == product_id,
                    Product.updated_at == command.expected_updated_at,
                )
                .values(**values)
                .returning(Product)
            )
            if product is None:
                if await self._session.get(Product, product_id) is None:
                    raise AdminCatalogNotFoundError(product_id)
                raise ConcurrentUpdateError(product_id)
        return AdminProductView.model_validate(product)

    async def archive_product(
        self, product_id: UUID, expected_updated_at: datetime
    ) -> AdminProductView:
        now = datetime.now(UTC)
        async with self._session.begin():
            product = await self._session.scalar(
                update(Product)
                .where(Product.id == product_id, Product.updated_at == expected_updated_at)
                .values(archived_at=now, is_published=False, updated_at=now)
                .returning(Product)
            )
            if product is None:
                raise ConcurrentUpdateError(product_id)
        return AdminProductView.model_validate(product)

    async def create_body_color(self, command: CreateBodyColorCommand) -> BodyColorAdminView:
        item = BodyColor(**command.model_dump())
        await self._add(item)
        return BodyColorAdminView.model_validate(item)

    async def create_panel_color(self, command: CreatePanelColorCommand) -> ReferenceView:
        item = PanelColor(**command.model_dump())
        await self._add(item)
        return ReferenceView.model_validate(item)

    async def create_control_type(self, command: CreateControlTypeCommand) -> ControlTypeAdminView:
        item = ControlType(**command.model_dump())
        await self._add(item)
        return ControlTypeAdminView.model_validate(item)

    async def create_variant(self, command: CreateVariantCommand) -> AdminVariantView:
        async with self._session.begin():
            await self._require_references(command)
            variant = ProductVariant(**command.model_dump())
            self._session.add(variant)
            try:
                await self._session.flush()
            except IntegrityError as exc:
                raise CatalogConflictError from exc
        return AdminVariantView.model_validate(variant)

    async def update_variant(
        self, variant_id: UUID, command: UpdateVariantCommand
    ) -> AdminVariantView:
        values = command.model_dump(exclude={"expected_updated_at"}, exclude_none=True)
        values["updated_at"] = datetime.now(UTC)
        async with self._session.begin():
            variant = await self._session.scalar(
                update(ProductVariant)
                .where(
                    ProductVariant.id == variant_id,
                    ProductVariant.updated_at == command.expected_updated_at,
                )
                .values(**values)
                .returning(ProductVariant)
            )
            if variant is None:
                raise ConcurrentUpdateError(variant_id)
        return AdminVariantView.model_validate(variant)

    async def _require_references(self, command: CreateVariantCommand) -> None:
        checks = (
            (Product, command.product_id),
            (BodyColor, command.body_color_id),
            (PanelColor, command.panel_color_id),
            (ControlType, command.control_type_id),
        )
        for model, identifier in checks:
            if await self._session.scalar(select(model.id).where(model.id == identifier)) is None:
                raise AdminCatalogNotFoundError(identifier)

    async def _add(self, instance: object) -> None:
        try:
            async with self._session.begin():
                self._session.add(instance)
                await self._session.flush()
        except IntegrityError as exc:
            raise CatalogConflictError from exc
