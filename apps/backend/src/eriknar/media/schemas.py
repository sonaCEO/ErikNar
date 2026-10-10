from pydantic import BaseModel, Field


class StoredImage(BaseModel):
    bucket: str
    object_key: str
    mime_type: str
    size_bytes: int = Field(gt=0)
    public_url: str
