from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from eriknar.catalog.models import Product
from eriknar.db.session import get_session
from eriknar.main import create_app
from eriknar.media.admin_api import get_admin_media_service
from eriknar.media.admin_service import AdminMediaService
from eriknar.users.enums import UserRole
from eriknar.users.models import User
from eriknar.users.security import hash_password


class MemoryObjectStorage:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], tuple[bytes, str]] = {}

    async def put(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        self.objects[(bucket, key)] = (data, content_type)

    async def delete(self, bucket: str, key: str) -> None:
        self.objects.pop((bucket, key), None)

    def public_url(self, bucket: str, key: str) -> str:
        return f"https://media.example/{bucket}/{key}"


async def _client(
    database_url: str,
) -> tuple[AsyncClient, AsyncEngine, Product, MemoryObjectStorage]:
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        product = Product(
            slug="lesenka",
            name="Лесенка",
            model_code="B",
            category="rail",
            short_description="Кратко",
            description="Описание",
            max_temperature=60,
            heater_type="Сухой ТЭН",
            warranty_months=24,
        )
        session.add_all(
            [
                product,
                User(
                    name="Admin",
                    login="admin",
                    password_hash=hash_password("strong-password"),
                    role=UserRole.ADMIN,
                ),
            ]
        )
        await session.commit()

    storage = MemoryObjectStorage()

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    async def override_media_service() -> AsyncIterator[AdminMediaService]:
        async with factory() as session:
            yield AdminMediaService(
                session=session,
                storage=storage,
                bucket="product-media",
                max_size_bytes=1024,
            )

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_admin_media_service] = override_media_service
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")
    login = await client.post(
        "/api/v1/auth/login", json={"login": "admin", "password": "strong-password"}
    )
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    return client, engine, product, storage


@pytest.mark.anyio
async def test_admin_uploads_updates_lists_and_deletes_product_image(
    migrated_postgres_url: str,
) -> None:
    client, engine, product, storage = await _client(migrated_postgres_url)

    uploaded = await client.post(
        f"/api/v1/admin/catalog/products/{product.id}/media",
        data={"alt_text": "Белая лесенка", "sort_order": "2", "is_primary": "true"},
        files={"file": ("lesenka.png", b"\x89PNG\r\n\x1a\npng-data", "image/png")},
    )
    listed = await client.get(f"/api/v1/admin/catalog/products/{product.id}/media")
    updated = await client.patch(
        f"/api/v1/admin/catalog/media/{uploaded.json()['id']}",
        json={
            "expected_updated_at": uploaded.json()["updated_at"],
            "alt_text": "Лесенка ErikNar белого цвета",
            "sort_order": 1,
        },
    )
    deleted = await client.delete(f"/api/v1/admin/catalog/media/{uploaded.json()['id']}")

    assert uploaded.status_code == 201
    assert uploaded.json()["url"].startswith("https://media.example/product-media/")
    assert uploaded.json()["is_primary"] is True
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [uploaded.json()["id"]]
    assert updated.status_code == 200
    assert updated.json()["alt_text"] == "Лесенка ErikNar белого цвета"
    assert deleted.status_code == 204
    assert storage.objects == {}

    await client.aclose()
    await engine.dispose()


@pytest.mark.anyio
async def test_admin_media_rejects_spoofed_image(migrated_postgres_url: str) -> None:
    client, engine, product, storage = await _client(migrated_postgres_url)

    response = await client.post(
        f"/api/v1/admin/catalog/products/{product.id}/media",
        files={"file": ("fake.png", b"not-a-png", "image/png")},
    )

    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_media_type"
    assert storage.objects == {}

    await client.aclose()
    await engine.dispose()


@pytest.mark.anyio
async def test_new_primary_image_replaces_previous_primary(migrated_postgres_url: str) -> None:
    client, engine, product, _storage = await _client(migrated_postgres_url)
    file = {"file": ("lesenka.webp", b"RIFF\x04\x00\x00\x00WEBPdata", "image/webp")}

    first = await client.post(
        f"/api/v1/admin/catalog/products/{product.id}/media",
        data={"is_primary": "true"},
        files=file,
    )
    second = await client.post(
        f"/api/v1/admin/catalog/products/{product.id}/media",
        data={"is_primary": "true"},
        files=file,
    )
    listed = await client.get(f"/api/v1/admin/catalog/products/{product.id}/media")

    assert first.status_code == 201
    assert second.status_code == 201
    states = {item["id"]: item["is_primary"] for item in listed.json()}
    assert states == {first.json()["id"]: False, second.json()["id"]: True}

    await client.aclose()
    await engine.dispose()
