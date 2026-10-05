from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from eriknar.catalog.api import router as catalog_router
from eriknar.leads.api import router as leads_router


class HealthResponse(BaseModel):
    status: Literal["ok"]


router = APIRouter(prefix="/api/v1")
router.include_router(catalog_router)
router.include_router(leads_router)


@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(status="ok")
