from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from eriknar.catalog.enums import AvailabilityStatus


class CreateProductCommand(BaseModel):
    slug: str | None = Field(
        default=None,
        min_length=1,
        max_length=120,
        description="Адрес товара. Если не указан, генерируется автоматически из названия.",
    )
    name: str = Field(min_length=1, max_length=200)
    model_code: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=80)
    short_description: str = Field(min_length=1, max_length=500)
    description: str = Field(min_length=1)
    max_temperature: int = Field(gt=0)
    heater_type: str = Field(min_length=1, max_length=120)
    warranty_months: int = Field(ge=0)
    sort_order: int = Field(default=0, ge=0)
    is_published: bool = False


class UpdateProductCommand(BaseModel):
    expected_updated_at: datetime
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    model_code: str | None = Field(default=None, min_length=1, max_length=80)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    short_description: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, min_length=1)
    max_temperature: int | None = Field(default=None, gt=0)
    heater_type: str | None = Field(default=None, min_length=1, max_length=120)
    warranty_months: int | None = Field(default=None, ge=0)
    sort_order: int | None = Field(default=None, ge=0)
    is_published: bool | None = None


class AdminProductView(CreateProductCommand):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    id: UUID
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProductPage(BaseModel):
    items: list[AdminProductView]
    page: int
    page_size: int
    total: int


class ArchiveProductCommand(BaseModel):
    expected_updated_at: datetime


class ReferenceRefCommand(BaseModel):
    """Reuse an existing reference row by `id`, or create a new one from `name`."""

    id: UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=1, max_length=80)
    hex_value: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    description: str = ""

    @model_validator(mode="after")
    def require_id_or_name(self) -> "ReferenceRefCommand":
        if self.id is None and not self.name:
            raise ValueError("укажите id существующего значения или name для нового")
        return self


class CreateProductVariantInput(BaseModel):
    sku: str = Field(min_length=1, max_length=120)
    width_mm: int = Field(gt=0)
    height_mm: int = Field(gt=0)
    body_color: ReferenceRefCommand
    panel_color: ReferenceRefCommand
    control_type: ReferenceRefCommand
    price_minor: int = Field(ge=0)
    currency: str = Field(default="RUB", pattern=r"^[A-Z]{3}$")
    availability_status: AvailabilityStatus = AvailabilityStatus.IN_STOCK
    is_active: bool = True


class CreateProductWithVariantsCommand(CreateProductCommand):
    variants: list[CreateProductVariantInput] = Field(default_factory=list)


class CreateBodyColorCommand(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)
    hex_value: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class CreatePanelColorCommand(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=120)


class CreateControlTypeCommand(CreatePanelColorCommand):
    description: str = ""


class ReferenceView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class BodyColorAdminView(ReferenceView):
    hex_value: str


class ControlTypeAdminView(ReferenceView):
    description: str


class CreateVariantCommand(BaseModel):
    product_id: UUID
    sku: str = Field(min_length=1, max_length=120)
    width_mm: int = Field(gt=0)
    height_mm: int = Field(gt=0)
    body_color_id: UUID
    control_type_id: UUID
    panel_color_id: UUID
    price_minor: int = Field(ge=0)
    currency: str = Field(default="RUB", pattern=r"^[A-Z]{3}$")
    availability_status: AvailabilityStatus
    is_active: bool = True


class UpdateVariantCommand(BaseModel):
    expected_updated_at: datetime
    price_minor: int | None = Field(default=None, ge=0)
    availability_status: AvailabilityStatus | None = None
    is_active: bool | None = None


class AdminVariantView(CreateVariantCommand):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class CreatedProductView(AdminProductView):
    variants: list[AdminVariantView] = Field(default_factory=list)
