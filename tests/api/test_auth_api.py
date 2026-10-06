from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from eriknar.core.config import Settings
from eriknar.db.session import get_session
from eriknar.main import create_app
from eriknar.users.enums import UserRole
from eriknar.users.models import User
from eriknar.users.security import create_access_token, hash_password


async def _client_and_user(
    database_url: str,
    *,
    role: UserRole = UserRole.ADMIN,
    active: bool = True,
) -> tuple[AsyncClient, User, async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        user = User(
            name="Мария",
            login="maria",
            password_hash=hash_password("strong-password"),
            role=role,
            is_active=active,
        )
        session.add(user)
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
    return client, user, factory


@pytest.mark.anyio
async def test_login_and_me_return_employee_identity(migrated_postgres_url: str) -> None:
    client, user, factory = await _client_and_user(migrated_postgres_url)
    async with client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"login": "  MARIA ", "password": "strong-password"},
        )
        me = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        )

    assert login.status_code == 200
    assert login.json()["token_type"] == "bearer"
    assert me.status_code == 200
    assert me.json() == {
        "id": str(user.id),
        "name": "Мария",
        "login": "maria",
        "role": "admin",
        "is_active": True,
        "telegram_user_id": None,
    }
    await factory.kw["bind"].dispose()


@pytest.mark.anyio
async def test_login_uses_generic_error_for_invalid_or_inactive_user(
    migrated_postgres_url: str,
) -> None:
    client, _, factory = await _client_and_user(migrated_postgres_url, active=False)
    async with client:
        inactive = await client.post(
            "/api/v1/auth/login",
            json={"login": "maria", "password": "strong-password"},
        )
        missing = await client.post(
            "/api/v1/auth/login",
            json={"login": "unknown", "password": "strong-password"},
        )

    assert inactive.status_code == missing.status_code == 401
    assert inactive.json() == missing.json()
    assert inactive.json()["error"]["code"] == "invalid_credentials"
    await factory.kw["bind"].dispose()


@pytest.mark.anyio
async def test_inactive_user_cannot_use_previously_issued_token(
    migrated_postgres_url: str,
) -> None:
    client, user, factory = await _client_and_user(migrated_postgres_url)
    async with client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"login": "maria", "password": "strong-password"},
        )
        async with factory() as session:
            stored = await session.get(User, user.id)
            assert stored is not None
            stored.is_active = False
            await session.commit()
        me = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        )

    assert me.status_code == 401
    assert me.json()["error"]["code"] == "invalid_access_token"
    await factory.kw["bind"].dispose()


@pytest.mark.anyio
async def test_token_version_change_revokes_existing_token(migrated_postgres_url: str) -> None:
    client, user, factory = await _client_and_user(migrated_postgres_url)
    async with client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"login": "maria", "password": "strong-password"},
        )
        async with factory() as session:
            stored = await session.get(User, user.id)
            assert stored is not None
            stored.token_version += 1
            await session.commit()
        me = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {login.json()['access_token']}"},
        )

    assert me.status_code == 401
    await factory.kw["bind"].dispose()


@pytest.mark.anyio
async def test_expired_token_is_rejected_by_api(migrated_postgres_url: str) -> None:
    client, user, factory = await _client_and_user(migrated_postgres_url)
    token = create_access_token(
        user,
        Settings(),
        now=datetime.now(UTC) - timedelta(minutes=16),
    )
    async with client:
        response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    await factory.kw["bind"].dispose()


@pytest.mark.anyio
async def test_repeated_failed_login_is_rate_limited_and_success_clears_counter(
    migrated_postgres_url: str,
) -> None:
    client, _, factory = await _client_and_user(migrated_postgres_url)
    async with client:
        failures = [
            await client.post(
                "/api/v1/auth/login",
                json={"login": "maria", "password": "wrong"},
            )
            for _ in range(5)
        ]

    assert [response.status_code for response in failures[:4]] == [401] * 4
    assert failures[4].status_code == 429
    assert failures[4].json()["error"]["code"] == "login_rate_limited"
    await factory.kw["bind"].dispose()


@pytest.mark.anyio
async def test_successful_login_clears_failed_attempt_counter(migrated_postgres_url: str) -> None:
    client, _, factory = await _client_and_user(migrated_postgres_url)
    async with client:
        for _ in range(4):
            failed = await client.post(
                "/api/v1/auth/login", json={"login": "maria", "password": "wrong"}
            )
            assert failed.status_code == 401
        success = await client.post(
            "/api/v1/auth/login",
            json={"login": "maria", "password": "strong-password"},
        )
        after_reset = [
            await client.post("/api/v1/auth/login", json={"login": "maria", "password": "wrong"})
            for _ in range(4)
        ]

    assert success.status_code == 200
    assert [response.status_code for response in after_reset] == [401] * 4
    await factory.kw["bind"].dispose()
