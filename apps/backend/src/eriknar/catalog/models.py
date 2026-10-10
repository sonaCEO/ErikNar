from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.db.base import Base
from eriknar.db.types import TimestampMixin, UUIDPrimaryKeyMixin


class Product(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "products"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    model_code: Mapped[str] = mapped_column(String(80), unique=True)
    category: Mapped[str] = mapped_column(String(80))
    short_description: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text)
    max_temperature: Mapped[int] = mapped_column(Integer)
    heater_type: Mapped[str] = mapped_column(String(120))
    warranty_months: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )
    media: Mapped[list["ProductMedia"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
        foreign_keys="ProductMedia.product_id",
    )


class BodyColor(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "body_colors"

    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    hex_value: Mapped[str] = mapped_column(String(7))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class PanelColor(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "panel_colors"

    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class ControlType(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "control_types"

    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")


class ProductVariant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "product_variants"
    __table_args__ = (
        CheckConstraint("width_mm > 0", name="positive_width"),
        CheckConstraint("height_mm > 0", name="positive_height"),
        CheckConstraint("price_minor >= 0", name="non_negative_price"),
        CheckConstraint("char_length(currency) = 3", name="currency_length"),
        UniqueConstraint(
            "product_id",
            "width_mm",
            "height_mm",
            "body_color_id",
            "control_type_id",
            "panel_color_id",
            name="uq_product_variants_configuration",
        ),
    )

    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    sku: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    width_mm: Mapped[int] = mapped_column(Integer)
    height_mm: Mapped[int] = mapped_column(Integer)
    body_color_id: Mapped[UUID] = mapped_column(ForeignKey("body_colors.id"))
    control_type_id: Mapped[UUID] = mapped_column(ForeignKey("control_types.id"))
    panel_color_id: Mapped[UUID] = mapped_column(ForeignKey("panel_colors.id"))
    price_minor: Mapped[int] = mapped_column(BigInteger)
    currency: Mapped[str] = mapped_column(String(3), default="RUB", server_default="RUB")
    availability_status: Mapped[AvailabilityStatus] = mapped_column(
        Enum(
            AvailabilityStatus,
            name="availability_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=AvailabilityStatus.IN_STOCK,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    product: Mapped[Product] = relationship(back_populates="variants")
    body_color: Mapped[BodyColor] = relationship()
    control_type: Mapped[ControlType] = relationship()
    panel_color: Mapped[PanelColor] = relationship()
    media: Mapped[list["ProductMedia"]] = relationship(
        back_populates="variant",
        cascade="all, delete-orphan",
        foreign_keys="ProductMedia.variant_id",
    )


class ProductMedia(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "product_media"
    __table_args__ = (
        CheckConstraint("size_bytes > 0", name="positive_size"),
        CheckConstraint("sort_order >= 0", name="non_negative_sort_order"),
        UniqueConstraint("bucket", "object_key", name="uq_product_media_object"),
    )

    product_id: Mapped[UUID] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    variant_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("product_variants.id", ondelete="CASCADE")
    )
    body_color_id: Mapped[UUID | None] = mapped_column(ForeignKey("body_colors.id"))
    bucket: Mapped[str] = mapped_column(String(120))
    object_key: Mapped[str] = mapped_column(String(500))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    alt_text: Mapped[str] = mapped_column(String(300), default="", server_default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    product: Mapped[Product] = relationship(back_populates="media", foreign_keys=[product_id])
    variant: Mapped[ProductVariant | None] = relationship(
        back_populates="media", foreign_keys=[variant_id]
    )
    body_color: Mapped[BodyColor | None] = relationship()
