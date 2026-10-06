from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant
from eriknar.customers.models import Customer
from eriknar.leads.enums import LeadSource, LeadStatus
from eriknar.leads.models import Lead
from eriknar.outbox.models import OutboxEvent


async def seed_lead_with_event(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    idempotency_key: str = "telegram-publication",
) -> tuple[UUID, UUID]:
    async with session_factory() as session:
        product = Product(
            slug=f"telegram-{idempotency_key}",
            name="Лесенка",
            model_code=f"TG-{idempotency_key}",
            category="heated_towel_rail",
            short_description="Электрическая лесенка",
            description="Подробное описание",
            max_temperature=60,
            heater_type="Сухой ТЭН",
            warranty_months=24,
            is_published=True,
        )
        body = BodyColor(slug=f"black-{idempotency_key}", name="Чёрный", hex_value="#202020")
        panel = PanelColor(slug=f"white-{idempotency_key}", name="Белая")
        control = ControlType(
            slug=f"touch-{idempotency_key}",
            name="Сенсорная",
            description="Дисплей температуры и таймер",
        )
        variant = ProductVariant(
            product=product,
            sku=f"ER-{idempotency_key}",
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
        customer = Customer(
            name="Анна",
            phone_original="+7 999 000-00-00",
            phone_normalized="+79990000000",
        )
        lead = Lead(
            customer=customer,
            variant=variant,
            source=LeadSource.WEBSITE,
            status=LeadStatus.NEW,
            snapshot={
                "product_id": str(UUID(int=3)),
                "product_name": "Лесенка",
                "model_code": "B",
                "variant_id": str(UUID(int=2)),
                "sku": "ER-B-800-500",
                "width_mm": 500,
                "height_mm": 800,
                "body_color": {"id": str(UUID(int=4)), "slug": "black", "name": "Чёрный"},
                "panel_color": {"id": str(UUID(int=5)), "slug": "white", "name": "Белая"},
                "control_type": {
                    "id": str(UUID(int=6)),
                    "slug": "touch",
                    "name": "Сенсорная",
                },
                "price_minor": 1_260_000,
                "currency": "RUB",
            },
            comment="Перезвонить",
            idempotency_key=idempotency_key,
            request_hash="a" * 64,
        )
        session.add(lead)
        await session.flush()
        event = OutboxEvent(
            event_type="lead.created",
            aggregate_type="lead",
            aggregate_id=lead.id,
            payload={"lead_id": str(lead.id)},
        )
        session.add(event)
        await session.commit()
        return lead.id, event.id
