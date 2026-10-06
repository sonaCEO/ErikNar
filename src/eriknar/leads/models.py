from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from eriknar.catalog.models import ProductVariant
from eriknar.customers.models import Customer
from eriknar.db.base import Base
from eriknar.db.types import TimestampMixin, UUIDPrimaryKeyMixin
from eriknar.leads.enums import LeadSource, LeadStatus
from eriknar.users.models import User


class Lead(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "leads"

    public_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True), default=uuid4, unique=True, index=True
    )
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id"))
    variant_id: Mapped[UUID] = mapped_column(ForeignKey("product_variants.id"))
    source: Mapped[LeadSource] = mapped_column(
        Enum(
            LeadSource,
            name="lead_source",
            values_callable=lambda enum: [item.value for item in enum],
        )
    )
    status: Mapped[LeadStatus] = mapped_column(
        Enum(
            LeadStatus,
            name="lead_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=LeadStatus.NEW,
        server_default=LeadStatus.NEW.value,
    )
    snapshot: Mapped[dict[str, object]] = mapped_column(JSONB)
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_phone: Mapped[str] = mapped_column(String(40))
    comment: Mapped[str] = mapped_column(Text, default="", server_default="")
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_to_user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"))
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    telegram_topic_id: Mapped[int | None] = mapped_column(BigInteger)
    telegram_message_id: Mapped[int | None] = mapped_column(BigInteger)

    customer: Mapped[Customer] = relationship()
    variant: Mapped[ProductVariant] = relationship()
    assigned_to: Mapped[User | None] = relationship()
