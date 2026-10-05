from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from eriknar.catalog.api import router as catalog_router


class HealthResponse(BaseModel):
    status: Literal["ok"]


router = APIRouter(prefix="/api/v1")
router.include_router(catalog_router)


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(status="ok")
