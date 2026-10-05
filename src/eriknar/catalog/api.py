from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.api.errors import ErrorResponse
from eriknar.catalog.repository import CatalogRepository
from eriknar.catalog.schemas import ProductDetail, ProductSummary
from eriknar.catalog.service import CatalogService
from eriknar.core.config import get_settings
from eriknar.db.session import get_session
from eriknar.media.storage import MinioObjectStorage

router = APIRouter(prefix="/catalog/products", tags=["catalog"])


def get_catalog_service(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CatalogService:
    settings = get_settings()
    storage = MinioObjectStorage(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        public_base_url=settings.media_public_base_url,
    )
    return CatalogService(CatalogRepository(session), media_url=storage.public_url)


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
