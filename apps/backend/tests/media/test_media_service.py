from uuid import uuid4

import pytest

from eriknar.media.service import MediaService, MediaTooLargeError, UnsupportedMediaTypeError


class MemoryObjectStorage:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], tuple[bytes, str]] = {}

    async def put(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        self.objects[(bucket, key)] = (data, content_type)

    async def delete(self, bucket: str, key: str) -> None:
        self.objects.pop((bucket, key), None)

    def public_url(self, bucket: str, key: str) -> str:
        return f"https://media.example/{bucket}/{key}"


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("content_type", "suffix", "content"),
    [
        ("image/jpeg", ".jpg", b"\xff\xd8\xff\xe0jpeg-data"),
        ("image/png", ".png", b"\x89PNG\r\n\x1a\npng-data"),
        ("image/webp", ".webp", b"RIFF\x04\x00\x00\x00WEBPdata"),
    ],
)
async def test_store_product_image_accepts_supported_formats(
    content_type: str, suffix: str, content: bytes
) -> None:
    storage = MemoryObjectStorage()
    product_id = uuid4()
    service = MediaService(storage=storage, bucket="product-media", max_size_bytes=100)

    media = await service.store_product_image(
        product_id=product_id,
        content=content,
        content_type=content_type,
        alt_text="Полотенцесушитель ErikNar",
        sort_order=2,
    )

    assert media.product_id == product_id
    assert media.object_key.startswith(f"products/{product_id}/")
    assert media.object_key.endswith(suffix)
    assert media.mime_type == content_type
    assert media.size_bytes == len(content)
    assert storage.objects[("product-media", media.object_key)] == (
        content,
        content_type,
    )


@pytest.mark.anyio
async def test_store_product_image_rejects_unsupported_format_before_storage() -> None:
    storage = MemoryObjectStorage()
    service = MediaService(storage=storage, bucket="product-media", max_size_bytes=100)

    with pytest.raises(UnsupportedMediaTypeError):
        await service.store_product_image(
            product_id=uuid4(),
            content=b"not-an-image",
            content_type="image/svg+xml",
            alt_text="",
            sort_order=0,
        )

    assert storage.objects == {}


@pytest.mark.anyio
async def test_store_product_image_rejects_spoofed_content_type_before_storage() -> None:
    storage = MemoryObjectStorage()
    service = MediaService(storage=storage, bucket="product-media", max_size_bytes=100)

    with pytest.raises(UnsupportedMediaTypeError):
        await service.store_product_image(
            product_id=uuid4(),
            content=b"this-is-not-a-png",
            content_type="image/png",
            alt_text="",
            sort_order=0,
        )

    assert storage.objects == {}


@pytest.mark.anyio
async def test_store_product_image_rejects_oversized_file_before_storage() -> None:
    storage = MemoryObjectStorage()
    service = MediaService(storage=storage, bucket="product-media", max_size_bytes=4)

    with pytest.raises(MediaTooLargeError):
        await service.store_product_image(
            product_id=uuid4(),
            content=b"12345",
            content_type="image/webp",
            alt_text="",
            sort_order=0,
        )

    assert storage.objects == {}
