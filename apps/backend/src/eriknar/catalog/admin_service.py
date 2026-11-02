import re
from datetime import UTC, datetime
from typing import TypeVar
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.catalog.admin_schemas import (
    AdminProductView,
    AdminVariantView,
    BodyColorAdminView,
    ControlTypeAdminView,
    CreateBodyColorCommand,
    CreateControlTypeCommand,
    CreatedProductView,
    CreatePanelColorCommand,
    CreateProductWithVariantsCommand,
    CreateVariantCommand,
    ProductPage,
    ReferenceRefCommand,
    ReferenceView,
    UpdateProductCommand,
    UpdateVariantCommand,
)
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant

_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",  # noqa: RUF001
    "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",  # noqa: RUF001
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",  # noqa: RUF001
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


_ReferenceModel = TypeVar("_ReferenceModel", BodyColor, PanelColor, ControlType)


def _slugify(name: str) -> str:
    transliterated = "".join(_TRANSLIT.get(char, char) for char in name.lower())
    return re.sub(r"[^a-z0-9]+", "-", transliterated).strip("-")[:120] or "product"


class CatalogConflictError(ValueError):
    pass


class ConcurrentUpdateError(CatalogConflictError):
    pass


class AdminCatalogNotFoundError(ValueError):
    pass


class AdminCatalogService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_product(self, command: CreateProductWithVariantsCommand) -> CreatedProductView:
        async with self._session.begin():
            values = command.model_dump(exclude={"variants"})
            values["slug"] = command.slug or await self._unique_slug(command.name)
            product = Product(**values)
            try:
                self._session.add(product)
                await self._session.flush()
            except IntegrityError as exc:
                raise CatalogConflictError from exc

            variants: list[ProductVariant] = []
            for item in command.variants:
                body_color = await self._resolve_reference(BodyColor, item.body_color)
                panel_color = await self._resolve_reference(PanelColor, item.panel_color)
                control_type = await self._resolve_reference(ControlType, item.control_type)
                variant = ProductVariant(
                    product_id=product.id,
                    sku=item.sku,
                    width_mm=item.width_mm,
                    height_mm=item.height_mm,
                    body_color_id=body_color.id,
                    panel_color_id=panel_color.id,
                    control_type_id=control_type.id,
                    price_minor=item.price_minor,
                    currency=item.currency,
                    availability_status=item.availability_status,
                    is_active=item.is_active,
                )
                try:
                    self._session.add(variant)
                    await self._session.flush()
                except IntegrityError as exc:
                    raise CatalogConflictError from exc
                variants.append(variant)

        return CreatedProductView(
            **AdminProductView.model_validate(product).model_dump(),
            variants=[AdminVariantView.model_validate(item) for item in variants],
        )

    async def _unique_slug(self, name: str) -> str:
        base = _slugify(name)
        candidate = base
        suffix = 2
        while await self._session.scalar(select(Product.id).where(Product.slug == candidate)):
            candidate = f"{base}-{suffix}"
            suffix += 1
        return candidate

    async def _resolve_reference(
        self,
        model: type[_ReferenceModel],
        ref: ReferenceRefCommand,
    ) -> _ReferenceModel:
        if ref.id is not None:
            instance = await self._session.get(model, ref.id)
            if instance is None:
                raise AdminCatalogNotFoundError(ref.id)
            return instance

        assert ref.name is not None  # enforced by ReferenceRefCommand validator
        slug = ref.slug or _slugify(ref.name)
        existing = await self._session.scalar(select(model).where(model.slug == slug))
        if existing is not None:
            return existing

        kwargs: dict[str, object] = {"slug": slug, "name": ref.name}
        if model is BodyColor:
            kwargs["hex_value"] = ref.hex_value or "#808080"
        if model is ControlType:
            kwargs["description"] = ref.description
        instance = model(**kwargs)
        self._session.add(instance)
        await self._session.flush()
        return instance

    async def get_product(self, product_id: UUID) -> AdminProductView:
        product = await self._session.get(Product, product_id)
        if product is None:
            raise AdminCatalogNotFoundError(product_id)
        return AdminProductView.model_validate(product)

    async def list_products(self, page: int, page_size: int) -> ProductPage:
        total = await self._session.scalar(select(func.count()).select_from(Product))
        products = await self._session.scalars(
            select(Product)
            .order_by(Product.sort_order, Product.name, Product.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return ProductPage(
            items=[AdminProductView.model_validate(item) for item in products],
            page=page,
            page_size=page_size,
            total=total or 0,
        )

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

    async def list_body_colors(self) -> list[BodyColorAdminView]:
        colors = await self._session.scalars(select(BodyColor).order_by(BodyColor.name))
        return [BodyColorAdminView.model_validate(item) for item in colors]

    async def create_panel_color(self, command: CreatePanelColorCommand) -> ReferenceView:
        item = PanelColor(**command.model_dump())
        await self._add(item)
        return ReferenceView.model_validate(item)

    async def list_panel_colors(self) -> list[ReferenceView]:
        colors = await self._session.scalars(select(PanelColor).order_by(PanelColor.name))
        return [ReferenceView.model_validate(item) for item in colors]

    async def create_control_type(self, command: CreateControlTypeCommand) -> ControlTypeAdminView:
        item = ControlType(**command.model_dump())
        await self._add(item)
        return ControlTypeAdminView.model_validate(item)

    async def list_control_types(self) -> list[ControlTypeAdminView]:
        types = await self._session.scalars(select(ControlType).order_by(ControlType.name))
        return [ControlTypeAdminView.model_validate(item) for item in types]

    async def list_variants(self, product_id: UUID | None) -> list[AdminVariantView]:
        statement = select(ProductVariant).order_by(ProductVariant.sku)
        if product_id is not None:
            statement = statement.where(ProductVariant.product_id == product_id)
        variants = await self._session.scalars(statement)
        return [AdminVariantView.model_validate(item) for item in variants]

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
