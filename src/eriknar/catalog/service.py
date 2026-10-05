from typing import Protocol

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import Product, ProductMedia, ProductVariant
from eriknar.catalog.schemas import (
    BodyColorView,
    ColorView,
    ControlTypeView,
    MediaView,
    ProductDetail,
    ProductSummary,
    VariantView,
)


class ProductNotFoundError(Exception):
    pass


class CatalogReader(Protocol):
    async def get_published_by_slug(self, slug: str) -> Product | None: ...

    async def list_published(self) -> list[Product]: ...


def _media_view(media: ProductMedia) -> MediaView:
    return MediaView(
        id=media.id,
        url=f"/{media.bucket}/{media.object_key}",
        alt_text=media.alt_text,
        sort_order=media.sort_order,
        is_primary=media.is_primary,
    )


def _variant_view(variant: ProductVariant) -> VariantView:
    return VariantView(
        id=variant.id,
        sku=variant.sku,
        width_mm=variant.width_mm,
        height_mm=variant.height_mm,
        price_minor=variant.price_minor,
        currency=variant.currency,
        availability_status=variant.availability_status,
        body_color=BodyColorView.model_validate(variant.body_color),
        panel_color=ColorView.model_validate(variant.panel_color),
        control_type=ControlTypeView.model_validate(variant.control_type),
        media=[
            _media_view(item) for item in sorted(variant.media, key=lambda item: item.sort_order)
        ],
    )


class CatalogService:
    def __init__(self, repository: CatalogReader) -> None:
        self._repository = repository

    async def get_product(self, slug: str) -> ProductDetail:
        product = await self._repository.get_published_by_slug(slug)
        if product is None:
            raise ProductNotFoundError(slug)
        variants = [
            _variant_view(variant)
            for variant in product.variants
            if variant.is_active and variant.availability_status is not AvailabilityStatus.HIDDEN
        ]
        return ProductDetail(
            id=product.id,
            slug=product.slug,
            name=product.name,
            model_code=product.model_code,
            category=product.category,
            short_description=product.short_description,
            description=product.description,
            max_temperature=product.max_temperature,
            heater_type=product.heater_type,
            warranty_months=product.warranty_months,
            variants=variants,
        )

    async def list_products(self) -> list[ProductSummary]:
        summaries: list[ProductSummary] = []
        for product in await self._repository.list_published():
            variants = [
                variant
                for variant in product.variants
                if variant.is_active
                and variant.availability_status is not AvailabilityStatus.HIDDEN
            ]
            prices = [variant.price_minor for variant in variants]
            primary = next((item for item in product.media if item.is_primary), None)
            summaries.append(
                ProductSummary(
                    id=product.id,
                    slug=product.slug,
                    name=product.name,
                    model_code=product.model_code,
                    short_description=product.short_description,
                    min_price_minor=min(prices) if prices else None,
                    currency=variants[0].currency if variants else "RUB",
                    primary_image_url=_media_view(primary).url if primary else None,
                )
            )
        return summaries
