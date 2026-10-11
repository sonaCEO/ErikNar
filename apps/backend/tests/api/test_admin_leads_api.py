from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from eriknar.db.session import get_session
from eriknar.main import create_app
from eriknar.users.enums import UserRole
from eriknar.users.models import User
from eriknar.users.security import hash_password
from tests.factories import seed_lead_with_event


async def _setup(
    database_url: str,
) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession], User, User, User, str]:
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    lead_id, _ = await seed_lead_with_event(factory, idempotency_key="admin-leads")
    async with factory() as session:
        admin = User(
            name="Владелец",
            login="admin",
            password_hash=hash_password("admin-password"),
            role=UserRole.ADMIN,
        )
        first = User(
            name="Мария",
            login="maria",
            password_hash=hash_password("manager-password"),
            role=UserRole.MANAGER,
        )
        second = User(
            name="Ольга",
            login="olga",
            password_hash=hash_password("manager-password"),
            role=UserRole.MANAGER,
        )
        session.add_all([admin, first, second])
        await session.commit()
    return engine, factory, admin, first, second, str(lead_id)


async def _client(
    factory: async_sessionmaker[AsyncSession], login: str, password: str
) -> AsyncClient:
    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")
    response = await client.post("/api/v1/auth/login", json={"login": login, "password": password})
    client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
    return client


@pytest.mark.anyio
async def test_manager_claims_filters_and_completes_lead_with_history(
    migrated_postgres_url: str,
) -> None:
    engine, factory, _admin, manager, _second, lead_id = await _setup(migrated_postgres_url)
    client = await _client(factory, "maria", "manager-password")

    initial = await client.get("/api/v1/admin/leads?status=new&page=1&page_size=20")
    claimed = await client.post(f"/api/v1/admin/leads/{lead_id}/claim")
    detail = await client.get(f"/api/v1/admin/leads/{lead_id}")
    completed = await client.patch(
        f"/api/v1/admin/leads/{lead_id}/status",
        json={
            "expected_updated_at": claimed.json()["updated_at"],
            "status": "completed",
            "comment": "Клиент подтвердил заказ",
        },
    )
    filtered = await client.get("/api/v1/admin/leads?status=completed")

    assert initial.status_code == 200
    assert initial.json()["total"] == 1
    assert claimed.status_code == 200
    assert claimed.json()["assigned_to"]["id"] == str(manager.id)
    assert claimed.json()["status"] == "in_progress"
    assert [item["action"] for item in detail.json()["history"]] == ["claimed"]
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["closed_at"] is not None
    assert [item["action"] for item in completed.json()["history"]] == [
        "claimed",
        "status_changed",
    ]
    assert filtered.json()["total"] == 1

    await client.aclose()
    await engine.dispose()


@pytest.mark.anyio
async def test_only_admin_reassigns_lead_and_stale_edit_conflicts(
    migrated_postgres_url: str,
) -> None:
    engine, factory, _admin, first, second, lead_id = await _setup(migrated_postgres_url)
    manager_client = await _client(factory, "maria", "manager-password")
    admin_client = await _client(factory, "admin", "admin-password")

    claimed = await manager_client.post(f"/api/v1/admin/leads/{lead_id}/claim")
    forbidden = await manager_client.patch(
        f"/api/v1/admin/leads/{lead_id}/assignee",
        json={
            "expected_updated_at": claimed.json()["updated_at"],
            "user_id": str(second.id),
        },
    )
    reassigned = await admin_client.patch(
        f"/api/v1/admin/leads/{lead_id}/assignee",
        json={
            "expected_updated_at": claimed.json()["updated_at"],
            "user_id": str(second.id),
            "comment": "Перераспределение нагрузки",
        },
    )
    stale = await admin_client.patch(
        f"/api/v1/admin/leads/{lead_id}/status",
        json={
            "expected_updated_at": claimed.json()["updated_at"],
            "status": "cancelled",
        },
    )

    assert forbidden.status_code == 403
    assert reassigned.status_code == 200
    assert reassigned.json()["assigned_to"]["id"] == str(second.id)
    assert reassigned.json()["history"][-1]["previous_assignee_id"] == str(first.id)
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "concurrent_update"

    await manager_client.aclose()
    await admin_client.aclose()
    await engine.dispose()
