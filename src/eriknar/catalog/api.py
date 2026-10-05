from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.api.errors import ErrorResponse
from eriknar.catalog.repository import CatalogRepository
from eriknar.catalog.schemas import ProductDetail, ProductSummary
from eriknar.catalog.service import CatalogService
from eriknar.db.session import get_session

router = APIRouter(prefix="/catalog/products", tags=["catalog"])


def get_catalog_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CatalogService:
    return CatalogService(CatalogRepository(session))


@router.get("", response_model=list[ProductSummary])
async def list_products(
    service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> list[ProductSummary]:
    return await service.list_products()


@router.get(
    "/{slug}",
    response_model=ProductDetail,
    responses={404: {"model": ErrorResponse}},
)
async def get_product(
    slug: str,
    service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> ProductDetail:
    return await service.get_product(slug)
