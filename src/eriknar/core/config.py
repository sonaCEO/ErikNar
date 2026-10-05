from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded exclusively from process environment variables."""

    model_config = SettingsConfigDict(env_prefix="ERIKNAR_", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://eriknar:eriknar@postgres:5432/eriknar"
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "eriknar"
    minio_secret_key: str = "change-me"
    minio_bucket: str = "product-media"
    minio_secure: bool = False
    media_public_base_url: str = "http://localhost:9000"
    media_max_size_bytes: int = 10 * 1024 * 1024
    telegram_bot_token: str | None = None
    telegram_manager_chat_id: int | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
