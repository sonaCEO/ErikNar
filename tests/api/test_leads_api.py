from typing import Any
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient

from eriknar.leads.api import get_lead_service
from eriknar.leads.enums import LeadStatus
from eriknar.leads.schemas import LeadResult, LeadSnapshot, SnapshotValue
from eriknar.leads.service import IdempotencyConflictError
from eriknar.main import create_app

PUBLIC_ID = UUID("10000000-0000-4000-8000-000000000001")
VARIANT_ID = UUID("20000000-0000-4000-8000-000000000002")


def _result() -> LeadResult:
    return LeadResult(
        public_id=PUBLIC_ID,
        status=LeadStatus.NEW,
        snapshot=LeadSnapshot(
            product_id=UUID("30000000-0000-4000-8000-000000000003"),
            product_name="Лесенка",
            model_code="B",
            variant_id=VARIANT_ID,
            sku="ER-B-800-500",
            width_mm=500,
            height_mm=800,
            body_color=SnapshotValue(id=UUID(int=4), slug="black", name="Чёрный"),
            panel_color=SnapshotValue(id=UUID(int=5), slug="panel-black", name="Чёрная"),
            control_type=SnapshotValue(id=UUID(int=6), slug="touch", name="Сенсорная"),
            price_minor=1_260_000,
            currency="RUB",
        ),
    )


class SuccessfulLeadService:
    async def create(self, command: object, idempotency_key: str) -> LeadResult:
        return _result()


class ConflictingLeadService:
    async def create(self, command: object, idempotency_key: str) -> LeadResult:
        raise IdempotencyConflictError(idempotency_key)


async def _request(service: object, *, with_key: bool = True) -> tuple[int, dict[str, Any]]:
    app = create_app()
    app.dependency_overrides[get_lead_service] = lambda: service
    headers = {"Idempotency-Key": "browser-request-1"} if with_key else {}
    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    ) as client:
        response = await client.post(
            "/api/v1/leads",
            headers=headers,
            json={
                "variant_id": str(VARIANT_ID),
                "customer_name": "Анна",
                "phone": "+7 999 000-00-00",
                "comment": "Позвонить после 18:00",
            },
        )
    return response.status_code, response.json()


@pytest.mark.anyio
async def test_create_lead_returns_public_identifier() -> None:
    status, payload = await _request(SuccessfulLeadService())

    assert status == 201
    assert payload == {"public_id": str(PUBLIC_ID), "status": "new"}


@pytest.mark.anyio
async def test_create_lead_requires_idempotency_key() -> None:
    status, payload = await _request(SuccessfulLeadService(), with_key=False)

    assert status == 422
    assert payload["error"] == {
        "code": "validation_error",
        "message": "Некорректные данные запроса",
        "details": payload["error"]["details"],
    }


@pytest.mark.anyio
async def test_idempotency_conflict_returns_stable_error() -> None:
    status, payload = await _request(ConflictingLeadService())

    assert status == 409
    assert payload == {
        "error": {
            "code": "idempotency_conflict",
            "message": "Ключ повторного запроса уже использован с другими данными",  # noqa: RUF001
            "details": {},
        }
    }
