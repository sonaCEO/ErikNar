import os
import subprocess
from uuid import uuid4

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine


def _alembic(database_url: str, *args: str) -> None:
    subprocess.run(
        ["uv", "run", "alembic", *args],
        check=True,
        env={**os.environ, "ERIKNAR_DATABASE_URL": database_url},
        capture_output=True,
        text=True,
    )


@pytest.mark.anyio
async def test_admin_migration_creates_required_schema(postgres_url: str) -> None:
    _alembic(postgres_url, "upgrade", "head")
    engine = create_async_engine(postgres_url)

    async with engine.connect() as connection:
        tables = await connection.run_sync(lambda sync: set(inspect(sync).get_table_names()))
        user_columns = await connection.run_sync(
            lambda sync: {item["name"]: item for item in inspect(sync).get_columns("users")}
        )
        product_columns = await connection.run_sync(
            lambda sync: {item["name"] for item in inspect(sync).get_columns("products")}
        )
        lead_indexes = await connection.run_sync(
            lambda sync: {item["name"] for item in inspect(sync).get_indexes("leads")}
        )

    assert {"lead_history", "auth_login_attempts", "pending_media_deletions"} <= tables
    assert {"login", "password_hash", "role", "token_version"} <= user_columns.keys()
    assert user_columns["telegram_user_id"]["nullable"] is True
    assert "sort_order" in product_columns
    assert "ix_leads_status_created_at" in lead_indexes
    await engine.dispose()


@pytest.mark.anyio
async def test_admin_migration_preserves_existing_rows_and_converts_rejected(
    postgres_url: str,
) -> None:
    _alembic(postgres_url, "upgrade", "0004")
    engine = create_async_engine(postgres_url)
    product_id, body_id, panel_id, control_id = (uuid4() for _ in range(4))
    variant_id, customer_id, lead_id, user_id = (uuid4() for _ in range(4))

    async with engine.begin() as connection:
        await connection.execute(
            text(
                """
                INSERT INTO products
                    (id, slug, name, model_code, category, short_description, description,
                     max_temperature, heater_type, warranty_months, is_published)
                VALUES (:id, 'legacy', 'Legacy', 'LEG', 'rail', 'short', 'long',
                        60, 'dry', 24, true)
                """
            ),
            {"id": product_id},
        )
        await connection.execute(
            text(
                "INSERT INTO body_colors (id, slug, name, hex_value) "
                "VALUES (:id, 'b', 'B', '#000000')"
            ),
            {"id": body_id},
        )
        await connection.execute(
            text("INSERT INTO panel_colors (id, slug, name) VALUES (:id, 'p', 'P')"),
            {"id": panel_id},
        )
        await connection.execute(
            text("INSERT INTO control_types (id, slug, name) VALUES (:id, 'c', 'C')"),
            {"id": control_id},
        )
        await connection.execute(
            text(
                """
                INSERT INTO product_variants
                    (id, product_id, sku, width_mm, height_mm, body_color_id,
                     control_type_id, panel_color_id, price_minor, currency, availability_status)
                VALUES (:id, :product_id, 'LEG-1', 400, 800, :body_id,
                        :control_id, :panel_id, 10000, 'RUB', 'in_stock')
                """
            ),
            {
                "id": variant_id,
                "product_id": product_id,
                "body_id": body_id,
                "control_id": control_id,
                "panel_id": panel_id,
            },
        )
        await connection.execute(
            text(
                """
                INSERT INTO customers (id, name, phone_original, phone_normalized)
                VALUES (:id, 'Client', '+70000000000', '+70000000000')
                """
            ),
            {"id": customer_id},
        )
        await connection.execute(
            text("INSERT INTO users (id, name, telegram_user_id) VALUES (:id, 'Manager', 42)"),
            {"id": user_id},
        )
        await connection.execute(
            text(
                """
                INSERT INTO leads
                    (id, public_id, customer_id, variant_id, source, status, snapshot,
                     idempotency_key, request_hash, customer_name, customer_phone)
                VALUES (:id, :public_id, :customer_id, :variant_id, 'website', 'rejected',
                        '{}'::jsonb, 'legacy-key', :request_hash, 'Client', '+70000000000')
                """
            ),
            {
                "id": lead_id,
                "public_id": uuid4(),
                "customer_id": customer_id,
                "variant_id": variant_id,
                "request_hash": "a" * 64,
            },
        )

    _alembic(postgres_url, "upgrade", "head")
    async with engine.begin() as connection:
        status = await connection.scalar(
            text("SELECT status::text FROM leads WHERE id = :id"), {"id": lead_id}
        )
        legacy_user = (
            await connection.execute(
                text("SELECT name, telegram_user_id, role::text FROM users WHERE id = :id"),
                {"id": user_id},
            )
        ).one()
        await connection.execute(
            text(
                """
                INSERT INTO users
                    (id, name, login, password_hash, role, token_version, telegram_user_id)
                VALUES (:id, 'Admin', 'admin', 'hash', 'admin', 0, NULL)
                """
            ),
            {"id": uuid4()},
        )

    assert status == "cancelled"
    assert legacy_user == ("Manager", 42, "manager")
    await engine.dispose()
