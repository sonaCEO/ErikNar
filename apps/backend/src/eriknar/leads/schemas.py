from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from eriknar.leads.enums import LeadSource, LeadStatus

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class CreateLeadCommand(BaseModel):
    variant_id: UUID | None = None
    customer_name: Name
    phone: str = Field(min_length=5, max_length=40)
    comment: str = Field(default="", max_length=2000)
    source: LeadSource = LeadSource.WEBSITE


class SnapshotValue(BaseModel):
    id: UUID
    slug: str
    name: str


class LeadSnapshot(BaseModel):
    product_id: UUID
    product_name: str
    model_code: str
    variant_id: UUID
    sku: str
    width_mm: int
    height_mm: int
    body_color: SnapshotValue
    panel_color: SnapshotValue
    control_type: SnapshotValue
    price_minor: int
    currency: str


class LeadResult(BaseModel):
    public_id: UUID
    number: int
    status: LeadStatus
    snapshot: LeadSnapshot | None
    created: bool = True


class CreateLeadRequest(BaseModel):
    variant_id: UUID | None = Field(
        default=None,
        description=(
            "ID выбранной комплектации из карточки товара. "
            "Не указывается для общей консультации или заявки на индивидуальный заказ."  # noqa: RUF001
        ),
    )
    customer_name: Name
    phone: str = Field(min_length=5, max_length=40)
    comment: str = Field(default="", max_length=2000)


class CreateLeadResponse(BaseModel):
    public_id: UUID = Field(description="Публичный UUID заявки для отображения клиенту")
    number: int = Field(description="Короткий последовательный номер заявки")
    status: LeadStatus


class ClaimResult(BaseModel):
    claimed: bool
    assigned_to_user_id: UUID
    status: LeadStatus


class LeadActionResult(BaseModel):
    assigned_to_user_id: UUID
    assigned_to_name: str | None = None
    status: LeadStatus
    number: int
    model_code: str | None
    telegram_topic_id: int | None
    claimed: bool | None = None
