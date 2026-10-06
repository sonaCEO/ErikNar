from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.catalog.admin_schemas import (
    AdminProductView,
    AdminVariantView,
    ArchiveProductCommand,
    BodyColorAdminView,
    ControlTypeAdminView,
    CreateBodyColorCommand,
    CreateControlTypeCommand,
    CreatePanelColorCommand,
    CreateProductCommand,
    CreateVariantCommand,
    ProductPage,
    ReferenceView,
    UpdateProductCommand,
    UpdateVariantCommand,
)
from eriknar.catalog.admin_service import AdminCatalogService
from eriknar.db.session import get_session
from eriknar.users.dependencies import require_admin
from eriknar.users.models import User

router = APIRouter(prefix="/admin/catalog", tags=["admin-catalog"])


def get_admin_catalog_service(
    session: Annotated[AsyncSession, Depends(get_session, use_cache=False)],
) -> AdminCatalogService:
    return AdminCatalogService(session)


Admin = Annotated[User, Depends(require_admin)]
Service = Annotated[AdminCatalogService, Depends(get_admin_catalog_service)]


@router.post("/products", response_model=AdminProductView, status_code=201)
async def create_product(
    payload: CreateProductCommand, admin: Admin, service: Service
) -> AdminProductView:
    del admin
    return await service.create_product(payload)


@router.get("/products", response_model=ProductPage)
async def list_products(
    admin: Admin,
    service: Service,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ProductPage:
    del admin
    return await service.list_products(page, page_size)


@router.get("/products/{product_id}", response_model=AdminProductView)
async def get_product(product_id: UUID, admin: Admin, service: Service) -> AdminProductView:
    del admin
    return await service.get_product(product_id)


@router.patch("/products/{product_id}", response_model=AdminProductView)
async def update_product(
    product_id: UUID, payload: UpdateProductCommand, admin: Admin, service: Service
) -> AdminProductView:
    del admin
    return await service.update_product(product_id, payload)


@router.post("/products/{product_id}/archive", response_model=AdminProductView)
async def archive_product(
    product_id: UUID, payload: ArchiveProductCommand, admin: Admin, service: Service
) -> AdminProductView:
    del admin
    return await service.archive_product(product_id, payload.expected_updated_at)


@router.post("/body-colors", response_model=BodyColorAdminView, status_code=201)
async def create_body_color(
    payload: CreateBodyColorCommand, admin: Admin, service: Service
) -> BodyColorAdminView:
    del admin
    return await service.create_body_color(payload)


@router.post("/panel-colors", response_model=ReferenceView, status_code=201)
async def create_panel_color(
    payload: CreatePanelColorCommand, admin: Admin, service: Service
) -> ReferenceView:
    del admin
    return await service.create_panel_color(payload)


@router.post("/control-types", response_model=ControlTypeAdminView, status_code=201)
async def create_control_type(
    payload: CreateControlTypeCommand, admin: Admin, service: Service
) -> ControlTypeAdminView:
    del admin
    return await service.create_control_type(payload)


@router.post("/variants", response_model=AdminVariantView, status_code=201)
async def create_variant(
    payload: CreateVariantCommand, admin: Admin, service: Service
) -> AdminVariantView:
    del admin
    return await service.create_variant(payload)


@router.patch("/variants/{variant_id}", response_model=AdminVariantView)
async def update_variant(
    variant_id: UUID, payload: UpdateVariantCommand, admin: Admin, service: Service
) -> AdminVariantView:
    del admin
    return await service.update_variant(variant_id, payload)
