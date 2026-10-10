import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from eriknar.users.cli import ensure_admin
from eriknar.users.enums import UserRole
from eriknar.users.models import User
from eriknar.users.security import verify_password


@pytest.mark.anyio
async def test_ensure_admin_is_idempotent(migrated_postgres_url: str) -> None:
    engine = create_async_engine(migrated_postgres_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    first = await ensure_admin(factory, name="Owner", login=" ADMIN ", password="password-one")
    second = await ensure_admin(factory, name="New Owner", login="admin", password="password-two")

    async with factory() as session:
        count = await session.scalar(select(func.count()).select_from(User))
        stored = await session.get(User, first.id)
    assert count == 1
    assert second.id == first.id
    assert stored is not None
    assert stored.name == "New Owner"
    assert stored.role is UserRole.ADMIN
    assert stored.is_active is True
    assert verify_password("password-two", stored.password_hash)
    await engine.dispose()
