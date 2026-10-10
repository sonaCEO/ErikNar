from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from eriknar.db.session import get_session
from eriknar.main import create_app
from eriknar.users.enums import UserRole
from eriknar.users.models import User
from eriknar.users.security import hash_password


async def _authorized_client(
    database_url: str, role: UserRole
) -> tuple[AsyncClient, async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        actor = User(
            name="Actor",
            login="actor",
            password_hash=hash_password("strong-password"),
            role=role,
        )
        session.add(actor)
        await session.commit()

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    client = AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False),
        base_url="http://testserver",
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={"login": "actor", "password": "strong-password"},
    )
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    return client, factory


@pytest.mark.anyio
async def test_admin_creates_and_deactivates_employee(migrated_postgres_url: str) -> None:
    client, factory = await _authorized_client(migrated_postgres_url, UserRole.ADMIN)
    created = await client.post(
        "/api/v1/admin/users",
        json={
            "name": "Ольга",
            "login": "  OLGA ",
            "password": "another-strong-password",
            "role": "manager",
            "telegram_user_id": 12345,
        },
    )
    updated = await client.patch(
        f"/api/v1/admin/users/{created.json()['id']}",
        json={"is_active": False},
    )

    assert created.status_code == 201
    assert created.json()["login"] == "olga"
    assert updated.status_code == 200
    assert updated.json()["is_active"] is False
    await client.aclose()
    await factory.kw["bind"].dispose()


@pytest.mark.anyio
async def test_manager_cannot_create_employee(migrated_postgres_url: str) -> None:
    client, factory = await _authorized_client(migrated_postgres_url, UserRole.MANAGER)
    response = await client.post(
        "/api/v1/admin/users",
        json={
            "name": "Ольга",
            "login": "olga",
            "password": "another-strong-password",
            "role": "manager",
        },
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"
    await client.aclose()
    await factory.kw["bind"].dispose()


@pytest.mark.anyio
async def test_normalized_duplicate_login_returns_conflict(migrated_postgres_url: str) -> None:
    client, factory = await _authorized_client(migrated_postgres_url, UserRole.ADMIN)
    payload = {
        "name": "Ольга",
        "login": "olga",
        "password": "another-strong-password",
        "role": "manager",
    }
    first = await client.post("/api/v1/admin/users", json=payload)
    second = await client.post("/api/v1/admin/users", json={**payload, "login": " OLGA "})

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "login_conflict"
    await client.aclose()
    await factory.kw["bind"].dispose()
