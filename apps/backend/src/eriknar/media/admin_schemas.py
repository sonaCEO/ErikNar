from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class UpdateMediaCommand(BaseModel):
    expected_updated_at: datetime
    alt_text: str | None = Field(default=None, max_length=300)
    sort_order: int | None = Field(default=None, ge=0)
    is_primary: bool | None = None


class AdminMediaView(BaseModel):
    id: UUID
    product_id: UUID
    variant_id: UUID | None
    body_color_id: UUID | None
    url: str
    mime_type: str
    size_bytes: int
    alt_text: str
    sort_order: int
    is_primary: bool
    created_at: datetime
    updated_at: datetime
