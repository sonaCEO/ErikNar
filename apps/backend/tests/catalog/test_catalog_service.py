from uuid import uuid4

import pytest
from pydantic import ValidationError

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import (
    BodyColor,
    ControlType,
    PanelColor,
    Product,
    ProductMedia,
    ProductVariant,
)
from eriknar.catalog.schemas import VariantData
from eriknar.catalog.service import CatalogService


def test_variant_rejects_negative_price() -> None:
    with pytest.raises(ValidationError):
        VariantData(
            sku="ER-LADDER-800-500-BLACK",
            width_mm=500,
            height_mm=800,
            price_minor=-1,
            currency="RUB",
            availability_status=AvailabilityStatus.IN_STOCK,
        )


def test_variant_requires_non_blank_sku() -> None:
    with pytest.raises(ValidationError):
        VariantData(
            sku="   ",
            width_mm=500,
            height_mm=800,
            price_minor=1_260_000,
            currency="RUB",
            availability_status=AvailabilityStatus.IN_STOCK,
        )


def test_availability_status_has_only_supported_values() -> None:
    assert {status.value for status in AvailabilityStatus} == {
        "in_stock",
        "made_to_order",
        "out_of_stock",
        "hidden",
    }


class CatalogRepositoryStub:
    def __init__(self, product: Product) -> None:
        self.product = product

    async def get_published_by_slug(self, slug: str) -> Product | None:
        return self.product if self.product.slug == slug else None

    async def list_published(self) -> list[Product]:
        return [self.product]


@pytest.mark.anyio
async def test_product_detail_exposes_only_active_visible_variants() -> None:
    body_color = BodyColor(
        id=uuid4(),
        slug="black",
        name="Чёрный матовый",
        hex_value="#20201f",
        is_active=True,
    )
    panel_color = PanelColor(id=uuid4(), slug="black", name="Чёрный", is_active=True)
    control = ControlType(
        id=uuid4(),
        slug="touch",
        name="Сенсорная",
        description="Дисплей температуры и таймер",
        is_active=True,
    )
    product = Product(
        id=uuid4(),
        slug="lesenka",
        name="Лесенка",
        model_code="B",
        category="heated_towel_rail",
        short_description="Электрическая лесенка",
        description="Полное описание",
        max_temperature=60,
        heater_type="Сухой ТЭН",
        warranty_months=24,
        is_published=True,
    )
    product.variants = [
        ProductVariant(
            id=uuid4(),
            sku="VISIBLE",
            width_mm=500,
            height_mm=800,
            body_color=body_color,
            panel_color=panel_color,
            control_type=control,
            price_minor=1_260_000,
            currency="RUB",
            availability_status=AvailabilityStatus.IN_STOCK,
            is_active=True,
        ),
        ProductVariant(
            id=uuid4(),
            sku="INACTIVE",
            width_mm=600,
            height_mm=800,
            body_color=body_color,
            panel_color=panel_color,
            control_type=control,
            price_minor=1_360_000,
            currency="RUB",
            availability_status=AvailabilityStatus.IN_STOCK,
            is_active=False,
        ),
        ProductVariant(
            id=uuid4(),
            sku="HIDDEN",
            width_mm=400,
            height_mm=800,
            body_color=body_color,
            panel_color=panel_color,
            control_type=control,
            price_minor=1_160_000,
            currency="RUB",
            availability_status=AvailabilityStatus.HIDDEN,
            is_active=True,
        ),
    ]

    detail = await CatalogService(CatalogRepositoryStub(product)).get_product("lesenka")

    assert [variant.sku for variant in detail.variants] == ["VISIBLE"]


@pytest.mark.anyio
async def test_product_detail_hides_variant_with_inactive_reference() -> None:
    body = BodyColor(
        id=uuid4(), slug="disabled", name="Скрытый", hex_value="#000000", is_active=False
    )
    variant = ProductVariant(
        id=uuid4(),
        sku="DISABLED-COLOR",
        width_mm=500,
        height_mm=800,
        body_color=body,
        panel_color=PanelColor(id=uuid4(), slug="white", name="Белый"),
        control_type=ControlType(id=uuid4(), slug="touch", name="Touch", description=""),
        price_minor=100,
        availability_status=AvailabilityStatus.IN_STOCK,
        is_active=True,
    )
    product = Product(
        id=uuid4(),
        slug="hidden-reference",
        name="Hidden",
        model_code="H",
        category="rail",
        short_description="short",
        description="long",
        max_temperature=60,
        heater_type="dry",
        warranty_months=24,
        is_published=True,
    )
    product.variants = [variant]

    detail = await CatalogService(CatalogRepositoryStub(product)).get_product(product.slug)

    assert detail.variants == []


@pytest.mark.anyio
async def test_variant_gallery_includes_product_color_and_variant_media() -> None:
    body = BodyColor(id=uuid4(), slug="black", name="Чёрный", hex_value="#202020", is_active=True)
    product = Product(
        id=uuid4(),
        slug="media",
        name="Модель",
        model_code="M",
        category="heated_towel_rail",
        short_description="Описание",
        description="Текст",
        max_temperature=60,
        heater_type="Сухой ТЭН",
        warranty_months=24,
        is_published=True,
    )
    variant = ProductVariant(
        id=uuid4(),
        sku="MEDIA",
        width_mm=500,
        height_mm=800,
        body_color=body,
        panel_color=PanelColor(id=uuid4(), slug="white", name="Белая", is_active=True),
        control_type=ControlType(
            id=uuid4(), slug="touch", name="Сенсорная", description="", is_active=True
        ),
        price_minor=1_000_000,
        currency="RUB",
        availability_status=AvailabilityStatus.IN_STOCK,
        is_active=True,
    )
    product.variants = [variant]
    product.media = [
        ProductMedia(
            id=uuid4(),
            product=product,
            bucket="media",
            object_key="product.webp",
            mime_type="image/webp",
            size_bytes=1,
            alt_text="Общее",
            sort_order=1,
            is_primary=True,
        ),
        ProductMedia(
            id=uuid4(),
            product=product,
            body_color_id=body.id,
            bucket="media",
            object_key="color.webp",
            mime_type="image/webp",
            size_bytes=1,
            alt_text="Цвет",
            sort_order=2,
            is_primary=False,
        ),
        ProductMedia(
            id=uuid4(),
            product=product,
            variant_id=variant.id,
            bucket="media",
            object_key="variant.webp",
            mime_type="image/webp",
            size_bytes=1,
            alt_text="Вариант",
            sort_order=3,
            is_primary=False,
        ),
    ]

    detail = await CatalogService(CatalogRepositoryStub(product)).get_product("media")

    assert [item.url for item in detail.variants[0].media] == [
        "/media/product.webp",
        "/media/color.webp",
        "/media/variant.webp",
    ]
