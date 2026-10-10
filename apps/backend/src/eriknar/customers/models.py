from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from eriknar.db.base import Base
from eriknar.db.types import TimestampMixin, UUIDPrimaryKeyMixin


class Customer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "customers"

    name: Mapped[str] = mapped_column(String(120))
    phone_original: Mapped[str] = mapped_column(String(40))
    phone_normalized: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    telegram_user_id: Mapped[int | None] = mapped_column(BigInteger)
    telegram_username: Mapped[str | None] = mapped_column(String(64))
