from typing import Annotated, Literal
from urllib.request import urlopen

from anyio import to_thread
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import text

from eriknar.catalog.api import router as catalog_router
from eriknar.core.config import get_settings
from eriknar.db.session import engine
from eriknar.leads.api import router as leads_router
from eriknar.users.api import router as users_router


class HealthResponse(BaseModel):
    status: Literal["ok"]


class ReadinessResponse(BaseModel):
    status: Literal["ok", "unavailable"]
    checks: dict[str, Literal["ok", "unavailable"]]


async def get_readiness() -> dict[str, object]:
    checks: dict[str, Literal["ok", "unavailable"]] = {}
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception:
        checks["postgres"] = "unavailable"

    settings = get_settings()
    scheme = "https" if settings.minio_secure else "http"
    url = f"{scheme}://{settings.minio_endpoint}/minio/health/live"

    def check_minio() -> None:
        with urlopen(url, timeout=2) as response:
            if response.status != 200:
                raise RuntimeError("MinIO health check failed")

    try:
        await to_thread.run_sync(check_minio)
        checks["minio"] = "ok"
    except Exception:
        checks["minio"] = "unavailable"

    status = "ok" if all(value == "ok" for value in checks.values()) else "unavailable"
    return {"status": status, "checks": checks}


router = APIRouter(prefix="/api/v1")
router.include_router(catalog_router)
router.include_router(leads_router)
router.include_router(users_router)


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/ready", response_model=ReadinessResponse, tags=["system"])
async def ready(
    response: Response,
    readiness: Annotated[dict[str, object], Depends(get_readiness)],
) -> dict[str, object]:
    if readiness["status"] != "ok":
        response.status_code = 503
    return readiness
