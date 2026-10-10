from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from eriknar.catalog.models import ProductVariant
from eriknar.customers.models import Customer
from eriknar.leads.models import Lead


class LeadRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_variant(self, variant_id: UUID) -> ProductVariant | None:
        statement = (
            select(ProductVariant)
            .where(ProductVariant.id == variant_id)
            .options(
                selectinload(ProductVariant.product),
                selectinload(ProductVariant.body_color),
                selectinload(ProductVariant.panel_color),
                selectinload(ProductVariant.control_type),
            )
        )
        return await self._session.scalar(statement)

    async def lock_idempotency_key(self, key: str) -> None:
        await self._session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": key},
        )

    async def lock_customer_phone(self, normalized_phone: str) -> None:
        await self._session.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:phone, 0))"),
            {"phone": f"customer-phone:{normalized_phone}"},
        )

    async def get_by_idempotency_key(self, key: str) -> Lead | None:
        return await self._session.scalar(select(Lead).where(Lead.idempotency_key == key))

    async def get_for_update(self, lead_id: UUID) -> Lead | None:
        return await self._session.scalar(select(Lead).where(Lead.id == lead_id).with_for_update())

    async def get_customer_by_phone(self, normalized_phone: str) -> Customer | None:
        return await self._session.scalar(
            select(Customer).where(Customer.phone_normalized == normalized_phone)
        )

    def add_customer(self, customer: Customer) -> None:
        self._session.add(customer)

    def add_lead(self, lead: Lead) -> None:
        self._session.add(lead)
