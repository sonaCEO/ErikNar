import os
import subprocess
from datetime import datetime
from uuid import UUID

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import Mapped, mapped_column

from eriknar.db.base import Base
from eriknar.db.types import TimestampMixin, UUIDPrimaryKeyMixin


class Probe(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "database_probe"

    label: Mapped[str] = mapped_column()


@pytest.mark.anyio
async def test_database_uses_utc_and_uuid(postgres_url: str) -> None:
    engine = create_async_engine(postgres_url)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        probe = Probe(label="ready")
        session.add(probe)
        await session.commit()
        await session.refresh(probe)

    assert isinstance(probe.id, UUID)
    assert isinstance(probe.created_at, datetime)
    assert probe.created_at.tzinfo is not None
    assert probe.updated_at.tzinfo is not None

    await engine.dispose()


def test_alembic_schema_matches_models(migrated_postgres_url: str) -> None:
    result = subprocess.run(
        ["uv", "run", "alembic", "check"],
        check=False,
        env={**os.environ, "ERIKNAR_DATABASE_URL": migrated_postgres_url},
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "No new upgrade operations detected" in result.stdout
