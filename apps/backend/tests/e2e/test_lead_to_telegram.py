from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant
from eriknar.db.session import get_session
from eriknar.leads.models import Lead
from eriknar.main import create_app
from eriknar.outbox.processor import OutboxProcessor
from eriknar.telegram.client import TelegramGateway


class CapturingGateway(TelegramGateway):
    def __init__(self) -> None:
        self.topic_names: list[str] = []
        self.cards: list[str] = []

    async def create_forum_topic(self, name: str) -> int:
        self.topic_names.append(name)
        return 701

    async def send_lead_card(self, topic_id: int, text: str, callback_data: str) -> int:
        self.cards.append(text)
        return 901


async def _seed_catalog(factory: async_sessionmaker[AsyncSession]) -> None:
    async with factory() as session:
        session.add(
            ProductVariant(
                product=Product(
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
                ),
                sku="ER-B-800-500",
                width_mm=500,
                height_mm=800,
                body_color=BodyColor(slug="black", name="Чёрный", hex_value="#202020"),
                panel_color=PanelColor(slug="white", name="Белая"),
                control_type=ControlType(
                    slug="touch", name="Сенсорная", description="Дисплей и таймер"
                ),
                price_minor=1_260_000,
                currency="RUB",
                availability_status=AvailabilityStatus.IN_STOCK,
                is_active=True,
            )
        )
        await session.commit()


@pytest.mark.anyio
async def test_catalog_lead_and_telegram_form_one_vertical_slice(
    migrated_postgres_url: str,
) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    await _seed_catalog(factory)

    async def database_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = database_session
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        catalog_response = await client.get("/api/v1/catalog/products/lesenka")
        assert catalog_response.status_code == 200
        variant = catalog_response.json()["variants"][0]

        lead_response = await client.post(
            "/api/v1/leads",
            headers={"Idempotency-Key": "e2e-browser-request"},
            json={
                "variant_id": variant["id"],
                "customer_name": "Анна",
                "phone": "+7 999 000-00-00",
                "comment": "Позвонить после 18:00",
            },
        )
        assert lead_response.status_code == 201

    gateway = CapturingGateway()
    assert await OutboxProcessor(factory, gateway).run_once() is True

    async with factory() as session:
        lead = await session.scalar(select(Lead))
        assert lead is not None
        assert lead.snapshot["price_minor"] == variant["price_minor"]
    assert len(gateway.topic_names) == 1
    assert len(gateway.cards) == 1
    assert "Лесенка" in gateway.cards[0]
    assert "12 600 ₽" in gateway.cards[0]
    assert "Позвонить после 18:00" in gateway.cards[0]
    await engine.dispose()
