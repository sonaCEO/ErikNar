from functools import lru_cache
from typing import Literal

from pydantic import model_validator
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
    telegram_outbox_poll_seconds: float = 1.0
    telegram_outbox_max_attempts: int = 8
    jwt_secret: str = "development-only-secret-change-before-production"
    jwt_issuer: str = "eriknar-api"
    jwt_audience: str = "eriknar-admin"
    access_token_minutes: int = 15
    login_max_failures: int = 5
    login_window_minutes: int = 15

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        if self.access_token_minutes <= 0:
            raise ValueError("access_token_minutes must be positive")
        if self.login_max_failures <= 0 or self.login_window_minutes <= 0:
            raise ValueError("login throttling settings must be positive")
        if len(self.jwt_secret) < 32:
            raise ValueError("jwt_secret must contain at least 32 characters")
        if self.environment == "production" and self.jwt_secret.startswith("development-only"):
            raise ValueError("production requires an explicit jwt_secret")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
