from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from eriknar.catalog.enums import AvailabilityStatus

SKU = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Currency = Annotated[str, StringConstraints(to_upper=True, pattern=r"^[A-Z]{3}$")]


class VariantData(BaseModel):
    sku: SKU
    width_mm: int = Field(gt=0, description="Ширина варианта в миллиметрах")
    height_mm: int = Field(gt=0, description="Высота варианта в миллиметрах")
    price_minor: int = Field(ge=0, description="Цена в копейках: 1 260 000 = 12 600 ₽")
    currency: Currency = Field(default="RUB", description="Трёхбуквенный код валюты")
    availability_status: AvailabilityStatus


class ColorView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str


class BodyColorView(ColorView):
    hex_value: str


class ControlTypeView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    description: str


class MediaView(BaseModel):
    id: UUID
    url: str
    alt_text: str
    sort_order: int = Field(description="Порядок фотографии в галерее")
    is_primary: bool = Field(description="Основная фотография варианта")


class VariantView(VariantData):
    id: UUID
    body_color: BodyColorView
    panel_color: ColorView
    control_type: ControlTypeView
    media: list[MediaView]


class ProductSummary(BaseModel):
    id: UUID
    slug: str
    name: str
    model_code: str
    short_description: str
    min_price_minor: int | None = Field(
        description="Минимальная цена среди доступных вариантов, в копейках"
    )
    currency: str
    primary_image_url: str | None


class ProductDetail(BaseModel):
    id: UUID
    slug: str
    name: str
    model_code: str
    category: str
    short_description: str
    description: str
    max_temperature: int
    heater_type: str
    warranty_months: int
    variants: list[VariantView]
