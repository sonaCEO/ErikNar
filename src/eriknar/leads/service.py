import hashlib
import json
import re
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import ProductVariant
from eriknar.customers.models import Customer
from eriknar.leads.enums import LeadStatus
from eriknar.leads.models import Lead
from eriknar.leads.repository import LeadRepository
from eriknar.leads.schemas import (
    ClaimResult,
    CreateLeadCommand,
    LeadActionResult,
    LeadResult,
    LeadSnapshot,
    SnapshotValue,
)
from eriknar.outbox.models import OutboxEvent
from eriknar.outbox.repository import OutboxRepository


class VariantUnavailableError(ValueError):
    pass


class IdempotencyConflictError(ValueError):
    pass


class InvalidPhoneError(ValueError):
    pass


class LeadNotFoundError(ValueError):
    pass


class InvalidLeadTransitionError(ValueError):
    pass


def normalize_russian_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 10:
        digits = f"7{digits}"
    if len(digits) == 11 and digits.startswith("8"):
        digits = f"7{digits[1:]}"
    if len(digits) != 11 or not digits.startswith("7"):
        raise InvalidPhoneError(phone)
    return f"+{digits}"


def _request_hash(command: CreateLeadCommand) -> str:
    canonical = json.dumps(
        command.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _snapshot(variant: ProductVariant) -> LeadSnapshot:
    return LeadSnapshot(
        product_id=variant.product.id,
        product_name=variant.product.name,
        model_code=variant.product.model_code,
        variant_id=variant.id,
        sku=variant.sku,
        width_mm=variant.width_mm,
        height_mm=variant.height_mm,
        body_color=SnapshotValue.model_validate(variant.body_color, from_attributes=True),
        panel_color=SnapshotValue.model_validate(variant.panel_color, from_attributes=True),
        control_type=SnapshotValue.model_validate(variant.control_type, from_attributes=True),
        price_minor=variant.price_minor,
        currency=variant.currency,
    )


def _result(lead: Lead, *, created: bool) -> LeadResult:
    return LeadResult(
        public_id=lead.public_id,
        status=lead.status,
        snapshot=LeadSnapshot.model_validate(lead.snapshot),
        created=created,
    )


class LeadService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._leads = LeadRepository(session)
        self._outbox = OutboxRepository(session)

    async def create(self, command: CreateLeadCommand, idempotency_key: str) -> LeadResult:
        request_hash = _request_hash(command)
        async with self._session.begin():
            await self._leads.lock_idempotency_key(idempotency_key)
            existing = await self._leads.get_by_idempotency_key(idempotency_key)
            if existing is not None:
                if existing.request_hash != request_hash:
                    raise IdempotencyConflictError(idempotency_key)
                return _result(existing, created=False)

            variant = await self._leads.get_variant(command.variant_id)
            if (
                variant is None
                or not variant.is_active
                or not variant.product.is_published
                or variant.product.archived_at is not None
                or variant.availability_status
                in {AvailabilityStatus.HIDDEN, AvailabilityStatus.OUT_OF_STOCK}
            ):
                raise VariantUnavailableError(command.variant_id)

            phone = normalize_russian_phone(command.phone)
            customer = await self._leads.get_customer_by_phone(phone)
            if customer is None:
                customer = Customer(
                    name=command.customer_name,
                    phone_original=command.phone,
                    phone_normalized=phone,
                )
                self._leads.add_customer(customer)
                await self._session.flush()

            snapshot = _snapshot(variant)
            lead = Lead(
                customer_id=customer.id,
                variant_id=variant.id,
                source=command.source,
                status=LeadStatus.NEW,
                snapshot=snapshot.model_dump(mode="json"),
                comment=command.comment,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
            )
            self._leads.add_lead(lead)
            await self._session.flush()
            self._outbox.add(
                OutboxEvent(
                    event_type="lead.created",
                    aggregate_type="lead",
                    aggregate_id=lead.id,
                    payload={"lead_id": str(lead.id)},
                )
            )

        return _result(lead, created=True)

    async def claim(self, lead_id: UUID, user_id: UUID) -> ClaimResult:
        async with self._session.begin():
            lead = await self._leads.get_for_update(lead_id)
            if lead is None:
                raise LeadNotFoundError(lead_id)
            if lead.assigned_to_user_id is not None:
                return ClaimResult(
                    claimed=False,
                    assigned_to_user_id=lead.assigned_to_user_id,
                    status=lead.status,
                )
            if lead.status != LeadStatus.NEW:
                raise ValueError(f"lead cannot be claimed from status {lead.status}")
            lead.assigned_to_user_id = user_id
            lead.assigned_at = datetime.now(UTC)
            lead.status = LeadStatus.IN_PROGRESS
        return ClaimResult(
            claimed=True,
            assigned_to_user_id=user_id,
            status=LeadStatus.IN_PROGRESS,
        )

    async def resolve(self, lead_id: UUID, user_id: UUID, target: LeadStatus) -> LeadActionResult:
        if target not in {LeadStatus.COMPLETED, LeadStatus.REJECTED}:
            raise InvalidLeadTransitionError(target)
        async with self._session.begin():
            lead = await self._leads.get_for_update(lead_id)
            if lead is None:
                raise LeadNotFoundError(lead_id)
            if lead.status != LeadStatus.IN_PROGRESS or lead.assigned_to_user_id != user_id:
                raise InvalidLeadTransitionError(lead_id)
            lead.status = target
            lead.closed_at = datetime.now(UTC)
        return LeadActionResult(assigned_to_user_id=user_id, status=target)
