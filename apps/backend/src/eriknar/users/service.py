import hashlib
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.core.config import Settings
from eriknar.users.models import AuthLoginAttempt, User
from eriknar.users.repository import UserRepository
from eriknar.users.schemas import CreateEmployeeCommand, UpdateEmployeeCommand, UserView
from eriknar.users.security import hash_password, verify_password

_DUMMY_PASSWORD_HASH = hash_password("eriknar-invalid-login-placeholder")


class InvalidCredentialsError(ValueError):
    pass


class LoginRateLimitedError(ValueError):
    pass


class LoginConflictError(ValueError):
    pass


class EmployeeNotFoundError(ValueError):
    pass


def normalize_login(login: str) -> str:
    return login.strip().casefold()


class AuthService:
    def __init__(
        self,
        session: AsyncSession,
        settings: Settings,
        client_ip: str = "unknown",
    ) -> None:
        self._session = session
        self._settings = settings
        self._users = UserRepository(session)
        self._client_ip = client_ip

    def _fingerprint(self, login: str) -> str:
        return hashlib.sha256(f"{login}|{self._client_ip}".encode()).hexdigest()

    async def authenticate(self, login: str, password: str) -> User:
        normalized = normalize_login(login)
        fingerprint = self._fingerprint(normalized)
        now = datetime.now(UTC)
        authenticated: User | None = None
        failure: type[ValueError] | None = None
        async with self._session.begin():
            attempt = await self._users.get_attempt_for_update(fingerprint)
            if attempt is not None and attempt.blocked_until is not None:
                if attempt.blocked_until > now:
                    failure = LoginRateLimitedError
                else:
                    await self._users.clear_attempt(fingerprint)
                    attempt = None

            if failure is None:
                user = await self._users.get_by_login(normalized)
                encoded = user.password_hash if user is not None else _DUMMY_PASSWORD_HASH
                valid = verify_password(password, encoded)
                if user is None or not user.is_active or not valid:
                    failure_count = await self._record_failure(attempt, fingerprint, now)
                    failure = (
                        LoginRateLimitedError
                        if failure_count >= self._settings.login_max_failures
                        else InvalidCredentialsError
                    )
                else:
                    await self._users.clear_attempt(fingerprint)
                    authenticated = user

        if failure is not None:
            raise failure
        if authenticated is None:
            raise InvalidCredentialsError
        return authenticated

    async def _record_failure(
        self,
        attempt: AuthLoginAttempt | None,
        fingerprint: str,
        now: datetime,
    ) -> int:
        window = timedelta(minutes=self._settings.login_window_minutes)
        if attempt is None or now - attempt.window_started_at >= window:
            if attempt is None:
                attempt = AuthLoginAttempt(
                    fingerprint=fingerprint,
                    failure_count=1,
                    window_started_at=now,
                )
                self._users.add_attempt(attempt)
            else:
                attempt.failure_count = 1
                attempt.window_started_at = now
                attempt.blocked_until = None
        else:
            attempt.failure_count += 1
        if attempt.failure_count >= self._settings.login_max_failures:
            attempt.blocked_until = now + window
        return attempt.failure_count


class EmployeeService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._users = UserRepository(session)

    async def create_employee(self, command: CreateEmployeeCommand) -> UserView:
        user = User(
            name=command.name.strip(),
            login=normalize_login(command.login),
            password_hash=hash_password(command.password),
            role=command.role,
            telegram_user_id=command.telegram_user_id,
        )
        try:
            async with self._session.begin():
                self._users.add(user)
                await self._session.flush()
        except IntegrityError as exc:
            raise LoginConflictError from exc
        return UserView.model_validate(user)

    async def set_employee_state(self, user_id: UUID, command: UpdateEmployeeCommand) -> UserView:
        async with self._session.begin():
            user = await self._users.get_by_id(user_id)
            if user is None:
                raise EmployeeNotFoundError(user_id)
            revoke = False
            if command.name is not None:
                user.name = command.name.strip()
            if command.password is not None:
                user.password_hash = hash_password(command.password)
                revoke = True
            if command.role is not None and command.role != user.role:
                user.role = command.role
                revoke = True
            if command.is_active is not None and command.is_active != user.is_active:
                user.is_active = command.is_active
                revoke = True
            if "telegram_user_id" in command.model_fields_set:
                user.telegram_user_id = command.telegram_user_id
            if revoke:
                user.token_version += 1
        return UserView.model_validate(user)
