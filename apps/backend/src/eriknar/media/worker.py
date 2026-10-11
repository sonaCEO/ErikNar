import asyncio
import logging

from eriknar.core.config import get_settings
from eriknar.db.session import engine, session_factory
from eriknar.media.cleanup_processor import MediaCleanupProcessor
from eriknar.media.storage import MinioObjectStorage

logger = logging.getLogger("eriknar.media.worker")


async def run() -> None:
    settings = get_settings()
    storage = MinioObjectStorage(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        public_base_url=settings.media_public_base_url,
    )
    processor = MediaCleanupProcessor(session_factory, storage)
    try:
        while True:
            try:
                processed = await processor.run_once()
            except Exception:
                logger.exception("media_cleanup_iteration_failed")
                processed = False
            if not processed:
                await asyncio.sleep(settings.media_cleanup_poll_seconds)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
