from pathlib import PurePosixPath
from uuid import UUID, uuid4

from eriknar.catalog.models import ProductMedia
from eriknar.media.storage import ObjectStorage

SUPPORTED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _content_matches_type(content: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    return False


class UnsupportedMediaTypeError(ValueError):
    pass


class MediaTooLargeError(ValueError):
    pass


class MediaService:
    def __init__(self, *, storage: ObjectStorage, bucket: str, max_size_bytes: int) -> None:
        self._storage = storage
        self._bucket = bucket
        self._max_size_bytes = max_size_bytes

    async def store_product_image(
        self,
        *,
        product_id: UUID,
        content: bytes,
        content_type: str,
        alt_text: str,
        sort_order: int,
        variant_id: UUID | None = None,
        body_color_id: UUID | None = None,
    ) -> ProductMedia:
        suffix = SUPPORTED_IMAGE_TYPES.get(content_type)
        if suffix is None:
            raise UnsupportedMediaTypeError(content_type)
        if len(content) > self._max_size_bytes:
            raise MediaTooLargeError(len(content))
        if not content:
            raise ValueError("Image cannot be empty")
        if not _content_matches_type(content, content_type):
            raise UnsupportedMediaTypeError(content_type)

        object_key = str(PurePosixPath("products", str(product_id), f"{uuid4().hex}{suffix}"))
        await self._storage.put(self._bucket, object_key, content, content_type)
        return ProductMedia(
            product_id=product_id,
            variant_id=variant_id,
            body_color_id=body_color_id,
            bucket=self._bucket,
            object_key=object_key,
            mime_type=content_type,
            size_bytes=len(content),
            alt_text=alt_text,
            sort_order=sort_order,
            is_primary=False,
        )
