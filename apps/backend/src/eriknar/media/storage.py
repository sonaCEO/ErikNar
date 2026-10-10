import json
from io import BytesIO
from typing import Protocol

from anyio import to_thread
from minio import Minio
from minio.error import S3Error


class ObjectStorage(Protocol):
    async def put(self, bucket: str, key: str, data: bytes, content_type: str) -> None: ...

    async def delete(self, bucket: str, key: str) -> None: ...

    def public_url(self, bucket: str, key: str) -> str: ...


class MinioObjectStorage:
    def __init__(
        self,
        *,
        endpoint: str,
        access_key: str,
        secret_key: str,
        secure: bool,
        public_base_url: str,
    ) -> None:
        self._client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
        self._public_base_url = public_base_url.rstrip("/")
        self._prepared_buckets: set[str] = set()

    def _ensure_bucket(self, bucket: str) -> None:
        if bucket in self._prepared_buckets:
            return
        if not self._client.bucket_exists(bucket):
            try:
                self._client.make_bucket(bucket)
            except S3Error as error:
                if error.code not in {"BucketAlreadyExists", "BucketAlreadyOwnedByYou"}:
                    raise
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
        self._client.set_bucket_policy(bucket, json.dumps(policy))
        self._prepared_buckets.add(bucket)

    async def put(self, bucket: str, key: str, data: bytes, content_type: str) -> None:
        def upload() -> None:
            self._ensure_bucket(bucket)
            self._client.put_object(
                bucket,
                key,
                BytesIO(data),
                length=len(data),
                content_type=content_type,
            )

        await to_thread.run_sync(upload)

    async def delete(self, bucket: str, key: str) -> None:
        await to_thread.run_sync(self._client.remove_object, bucket, key)

    def public_url(self, bucket: str, key: str) -> str:
        return f"{self._public_base_url}/{bucket}/{key}"
