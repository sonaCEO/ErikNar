import argparse
import asyncio
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from eriknar.db.session import session_factory
from eriknar.users.enums import UserRole
from eriknar.users.models import User
from eriknar.users.repository import UserRepository
from eriknar.users.security import hash_password
from eriknar.users.service import normalize_login


async def ensure_admin(
    factory: async_sessionmaker[AsyncSession],
    *,
    name: str,
    login: str,
    password: str,
) -> User:
    normalized = normalize_login(login)
    async with factory() as session, session.begin():
        repository = UserRepository(session)
        user = await repository.get_by_login(normalized)
        if user is None:
            user = User(
                name=name.strip(),
                login=normalized,
                password_hash=hash_password(password),
                role=UserRole.ADMIN,
            )
            repository.add(user)
            await session.flush()
        else:
            user.name = name.strip()
            user.password_hash = hash_password(password)
            user.role = UserRole.ADMIN
            user.is_active = True
            user.token_version += 1
    return user


def _required(value: str | None, label: str) -> str:
    if not value:
        raise SystemExit(f"{label} is required")
    return value


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m eriknar.users.cli")
    subparsers = parser.add_subparsers(dest="command", required=True)
    create = subparsers.add_parser("create-admin")
    create.add_argument("--name", default=os.getenv("ERIKNAR_ADMIN_NAME"))
    create.add_argument("--login", default=os.getenv("ERIKNAR_ADMIN_LOGIN"))
    create.add_argument("--password", default=os.getenv("ERIKNAR_ADMIN_PASSWORD"))
    args = parser.parse_args()
    if args.command == "create-admin":
        user = asyncio.run(
            ensure_admin(
                session_factory,
                name=_required(args.name, "admin name"),
                login=_required(args.login, "admin login"),
                password=_required(args.password, "admin password"),
            )
        )
        print(f"Administrator ready: {user.login}")


if __name__ == "__main__":
    main()
