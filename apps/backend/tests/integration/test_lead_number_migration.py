import os
import subprocess
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

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
async def test_lead_number_migration_backfills_in_stable_order(postgres_url: str) -> None:
    _alembic(postgres_url, "upgrade", "0006")
    engine = create_async_engine(postgres_url)
    product_id, body_id, panel_id, control_id = (uuid4() for _ in range(4))
    variant_id, customer_id = uuid4(), uuid4()
    first_id = UUID("00000000-0000-4000-8000-000000000001")
    second_id = UUID("00000000-0000-4000-8000-000000000002")
    terminal_id = UUID("00000000-0000-4000-8000-000000000003")
    created_at = datetime(2026, 1, 1, tzinfo=UTC)
    closed_at = datetime(2026, 1, 2, tzinfo=UTC)

    async with engine.begin() as connection:
        await connection.execute(
            text(
                """
                INSERT INTO products
                    (id, slug, name, model_code, category, short_description, description,
                     max_temperature, heater_type, warranty_months, is_published)
                VALUES (:id, 'legacy', 'Legacy', 'B', 'rail', 'short', 'long',
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
                "INSERT INTO customers (id, name, phone_original, phone_normalized) "
                "VALUES (:id, 'Client', '+70000000000', '+70000000000')"
            ),
            {"id": customer_id},
        )
        source_rows = (
            (second_id, "second", "new", None, None),
            (first_id, "first", "new", None, None),
            (terminal_id, "terminal", "completed", closed_at, 703),
        )
        for lead_id, key, status, lead_closed_at, topic_id in source_rows:
            await connection.execute(
                text(
                    """
                    INSERT INTO leads
                        (id, public_id, customer_id, variant_id, source, status, snapshot,
                         idempotency_key, request_hash, customer_name, customer_phone, created_at,
                         closed_at, telegram_topic_id)
                    VALUES (:id, :public_id, :customer_id, :variant_id, 'website',
                            CAST(:status AS lead_status), '{}'::jsonb, :key, :request_hash,
                            'Client', '+70000000000', :created_at, :closed_at, :topic_id)
                    """
                ),
                {
                    "id": lead_id,
                    "public_id": uuid4(),
                    "customer_id": customer_id,
                    "variant_id": variant_id,
                    "key": key,
                    "request_hash": (key * 64)[:64],
                    "created_at": created_at,
                    "status": status,
                    "closed_at": lead_closed_at,
                    "topic_id": topic_id,
                },
            )

    _alembic(postgres_url, "upgrade", "head")
    async with engine.connect() as connection:
        rows = (
            await connection.execute(text("SELECT id, number FROM leads ORDER BY number"))
        ).all()
        columns = await connection.run_sync(
            lambda sync: {column["name"]: column for column in inspect(sync).get_columns("leads")}
        )
        indexes = await connection.run_sync(
            lambda sync: {index["name"]: index for index in inspect(sync).get_indexes("leads")}
        )
        next_number = await connection.scalar(text("SELECT nextval('lead_number_seq')"))
        archive_event = (
            await connection.execute(
                text(
                    """
                    SELECT aggregate_id, next_attempt_at
                    FROM outbox_events
                    WHERE event_type = 'lead.archive_due'
                    """
                )
            )
        ).one()

    assert rows == [(first_id, 1), (second_id, 2), (terminal_id, 3)]
    assert columns["number"]["nullable"] is False
    assert indexes["ix_leads_number"]["unique"] is True
    assert next_number == 4
    assert archive_event == (terminal_id, closed_at + timedelta(hours=24))
    await engine.dispose()
