import urllib.request

import pytest
from minio import Minio
from minio.error import S3Error

from eriknar.media.storage import MinioObjectStorage


@pytest.mark.anyio
async def test_minio_storage_put_url_and_delete(minio_server: dict[str, object]) -> None:
    endpoint = str(minio_server["endpoint"])
    access_key = str(minio_server["access_key"])
    secret_key = str(minio_server["secret_key"])
    public_base_url = str(minio_server["public_base_url"])
    storage = MinioObjectStorage(
        endpoint=endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=False,
        public_base_url=public_base_url,
    )
    raw_client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        secure=False,
    )

    await storage.put("product-media", "fixtures/sample.webp", b"webp-bytes", "image/webp")
    response = raw_client.get_object("product-media", "fixtures/sample.webp")
    try:
        assert response.read() == b"webp-bytes"
    finally:
        response.close()
        response.release_conn()
    public_url = storage.public_url("product-media", "fixtures/sample.webp")
    assert public_url == (f"{public_base_url}/product-media/fixtures/sample.webp")
    with urllib.request.urlopen(public_url) as public_response:
        assert public_response.read() == b"webp-bytes"

    await storage.delete("product-media", "fixtures/sample.webp")

    with pytest.raises(S3Error) as error:
        raw_client.stat_object("product-media", "fixtures/sample.webp")
    assert error.value.code == "NoSuchKey"
