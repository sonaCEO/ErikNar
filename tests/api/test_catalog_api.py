from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from eriknar.catalog.api import get_catalog_service
from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import (
    BodyColor,
    ControlType,
    PanelColor,
    Product,
    ProductMedia,
    ProductVariant,
)
from eriknar.catalog.service import CatalogService
from eriknar.main import create_app


class CatalogRepositoryStub:
    def __init__(self, product: Product | None) -> None:
        self.product = product

    async def get_published_by_slug(self, slug: str) -> Product | None:
        if self.product is None or self.product.slug != slug:
            return None
        return self.product

    async def list_published(self) -> list[Product]:
        return [self.product] if self.product is not None else []


def _catalog_product() -> Product:
    body = BodyColor(id=uuid4(), slug="black", name="Чёрный матовый", hex_value="#20201f")
    panel = PanelColor(id=uuid4(), slug="panel-black", name="Чёрная")
    control = ControlType(
        id=uuid4(),
        slug="touch",
        name="Сенсорная",
        description="Дисплей температуры и таймер",
    )
    product = Product(
        id=uuid4(),
        slug="lesenka",
        name="Лесенка",
        model_code="B",
        category="heated_towel_rail",
        short_description="Электрическая лесенка",
        description="Подробное описание",
        max_temperature=60,
        heater_type="Сухой ТЭН",
        warranty_months=24,
        is_published=True,
    )
    visible = ProductVariant(
        id=uuid4(),
        sku="ER-B-800-500-BLACK-TOUCH",
        width_mm=500,
        height_mm=800,
        body_color=body,
        panel_color=panel,
        control_type=control,
        price_minor=1_260_000,
        currency="RUB",
        availability_status=AvailabilityStatus.IN_STOCK,
        is_active=True,
    )
    visible.media = [
        ProductMedia(
            id=uuid4(),
            product=product,
            bucket="product-media",
            object_key="second.webp",
            mime_type="image/webp",
            size_bytes=200,
            alt_text="Второе фото",
            sort_order=2,
            is_primary=False,
        ),
        ProductMedia(
            id=uuid4(),
            product=product,
            bucket="product-media",
            object_key="first.webp",
            mime_type="image/webp",
            size_bytes=100,
            alt_text="Первое фото",
            sort_order=1,
            is_primary=True,
        ),
    ]
    hidden = ProductVariant(
        id=uuid4(),
        sku="ER-HIDDEN",
        width_mm=600,
        height_mm=800,
        body_color=body,
        panel_color=panel,
        control_type=control,
        price_minor=1_360_000,
        currency="RUB",
        availability_status=AvailabilityStatus.HIDDEN,
        is_active=True,
    )
    product.variants = [visible, hidden]
    product.media = visible.media
    return product


async def _client_for(product: Product | None) -> AsyncClient:
    app = create_app()
    service = CatalogService(CatalogRepositoryStub(product))
    app.dependency_overrides[get_catalog_service] = lambda: service
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")


@pytest.mark.anyio
async def test_catalog_list_returns_public_json_contract() -> None:
    async with await _client_for(_catalog_product()) as client:
        response = await client.get("/api/v1/catalog/products")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": response.json()[0]["id"],
            "slug": "lesenka",
            "name": "Лесенка",
            "model_code": "B",
            "short_description": "Электрическая лесенка",
            "min_price_minor": 1_260_000,
            "currency": "RUB",
            "primary_image_url": "/product-media/first.webp",
        }
    ]


@pytest.mark.anyio
async def test_catalog_detail_returns_variants_and_ordered_media() -> None:
    async with await _client_for(_catalog_product()) as client:
        response = await client.get("/api/v1/catalog/products/lesenka")

    payload = response.json()
    assert response.status_code == 200
    assert set(payload) == {
        "id",
        "slug",
        "name",
        "model_code",
        "category",
        "short_description",
        "description",
        "max_temperature",
        "heater_type",
        "warranty_months",
        "variants",
    }
    assert [variant["sku"] for variant in payload["variants"]] == ["ER-B-800-500-BLACK-TOUCH"]
    assert isinstance(payload["variants"][0]["price_minor"], int)
    assert payload["variants"][0]["currency"] == "RUB"
    assert [media["sort_order"] for media in payload["variants"][0]["media"]] == [1, 2]


@pytest.mark.anyio
async def test_unknown_product_returns_stable_error_envelope() -> None:
    async with await _client_for(None) as client:
        response = await client.get("/api/v1/catalog/products/unknown")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "product_not_found",
            "message": "Товар не найден",
            "details": {},
        }
    }


@pytest.mark.anyio
async def test_openapi_contains_catalog_operations() -> None:
    async with await _client_for(None) as client:
        schema = (await client.get("/openapi.json")).json()

    assert "/api/v1/catalog/products" in schema["paths"]
    assert "/api/v1/catalog/products/{slug}" in schema["paths"]


@pytest.mark.anyio
async def test_internal_error_does_not_expose_database_details() -> None:
    class FailingCatalogService:
        async def list_products(self) -> list[object]:
            raise RuntimeError("postgresql://user:secret@database/internal")

    app = create_app()
    app.dependency_overrides[get_catalog_service] = FailingCatalogService
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        response = await client.get("/api/v1/catalog/products")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "Внутренняя ошибка сервера",
            "details": {},
        }
    }
    assert "secret" not in response.text
