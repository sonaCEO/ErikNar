from uuid import uuid4

import pytest
from pydantic import ValidationError

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant
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
    body_color = BodyColor(id=uuid4(), slug="black", name="Чёрный матовый", hex_value="#20201f")
    panel_color = PanelColor(id=uuid4(), slug="black", name="Чёрный")
    control = ControlType(
        id=uuid4(), slug="touch", name="Сенсорная", description="Дисплей температуры и таймер"
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
