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


async def _client(database_url: str, role: UserRole) -> tuple[AsyncClient, AsyncEngine]:
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add(
            User(
                name="Actor",
                login="actor",
                password_hash=hash_password("strong-password"),
                role=role,
            )
        )
        await session.commit()

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")
    login = await client.post(
        "/api/v1/auth/login", json={"login": "actor", "password": "strong-password"}
    )
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    return client, engine


def _product() -> dict[str, object]:
    return {
        "slug": "lesenka",
        "name": "Лесенка",
        "model_code": "B",
        "category": "rail",
        "short_description": "Кратко",
        "description": "Полное описание",
        "max_temperature": 60,
        "heater_type": "Сухой ТЭН",
        "warranty_months": 24,
        "sort_order": 1,
        "is_published": False,
    }


@pytest.mark.anyio
async def test_admin_creates_lists_updates_and_archives_product(
    migrated_postgres_url: str,
) -> None:
    client, engine = await _client(migrated_postgres_url, UserRole.ADMIN)
    created = await client.post("/api/v1/admin/catalog/products", json=_product())
    listed = await client.get("/api/v1/admin/catalog/products?page=1&page_size=20")
    updated = await client.patch(
        f"/api/v1/admin/catalog/products/{created.json()['id']}",
        json={"expected_updated_at": created.json()["updated_at"], "is_published": True},
    )
    archived = await client.post(
        f"/api/v1/admin/catalog/products/{created.json()['id']}/archive",
        json={"expected_updated_at": updated.json()["updated_at"]},
    )

    assert created.status_code == 201
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert updated.json()["is_published"] is True
    assert archived.json()["archived_at"] is not None
    await client.aclose()
    await engine.dispose()


@pytest.mark.anyio
async def test_stale_catalog_edit_returns_conflict(migrated_postgres_url: str) -> None:
    client, engine = await _client(migrated_postgres_url, UserRole.ADMIN)
    created = await client.post("/api/v1/admin/catalog/products", json=_product())
    payload = {"expected_updated_at": created.json()["updated_at"], "name": "First"}
    first = await client.patch(
        f"/api/v1/admin/catalog/products/{created.json()['id']}", json=payload
    )
    stale = await client.patch(
        f"/api/v1/admin/catalog/products/{created.json()['id']}", json=payload
    )

    assert first.status_code == 200
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "concurrent_update"
    await client.aclose()
    await engine.dispose()


@pytest.mark.anyio
async def test_manager_cannot_edit_catalog(migrated_postgres_url: str) -> None:
    client, engine = await _client(migrated_postgres_url, UserRole.MANAGER)
    response = await client.post("/api/v1/admin/catalog/products", json=_product())

    assert response.status_code == 403
    await client.aclose()
    await engine.dispose()
