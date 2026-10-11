from collections.abc import AsyncIterator
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.core.config import Settings, get_settings
from eriknar.db.session import get_session
from eriknar.media.admin_schemas import AdminMediaView, UpdateMediaCommand
from eriknar.media.admin_service import AdminMediaService
from eriknar.media.storage import MinioObjectStorage
from eriknar.users.dependencies import require_admin
from eriknar.users.models import User

router = APIRouter(prefix="/admin/catalog", tags=["admin-media"])


async def get_admin_media_service(
    session: Annotated[AsyncSession, Depends(get_session, use_cache=False)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AsyncIterator[AdminMediaService]:
    storage = MinioObjectStorage(
        endpoint=settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        public_base_url=settings.media_public_base_url,
    )
    yield AdminMediaService(
        session=session,
        storage=storage,
        bucket=settings.minio_bucket,
        max_size_bytes=settings.media_max_size_bytes,
    )


Admin = Annotated[User, Depends(require_admin)]
Service = Annotated[AdminMediaService, Depends(get_admin_media_service)]


@router.post("/products/{product_id}/media", response_model=AdminMediaView, status_code=201)
async def upload_product_media(
    product_id: UUID,
    admin: Admin,
    service: Service,
    file: Annotated[UploadFile, File(description="JPEG, PNG или WebP")],
    alt_text: Annotated[str, Form(max_length=300)] = "",
    sort_order: Annotated[int, Form(ge=0)] = 0,
    is_primary: Annotated[bool, Form()] = False,
    variant_id: Annotated[UUID | None, Form()] = None,
    body_color_id: Annotated[UUID | None, Form()] = None,
) -> AdminMediaView:
    del admin
    content = await file.read(service.max_upload_size + 1)
    return await service.upload(
        product_id=product_id,
        content=content,
        content_type=file.content_type or "application/octet-stream",
        alt_text=alt_text,
        sort_order=sort_order,
        is_primary=is_primary,
        variant_id=variant_id,
        body_color_id=body_color_id,
    )


@router.get("/products/{product_id}/media", response_model=list[AdminMediaView])
async def list_product_media(
    product_id: UUID, admin: Admin, service: Service
) -> list[AdminMediaView]:
    del admin
    return await service.list_for_product(product_id)


@router.patch("/media/{media_id}", response_model=AdminMediaView)
async def update_product_media(
    media_id: UUID,
    payload: UpdateMediaCommand,
    admin: Admin,
    service: Service,
) -> AdminMediaView:
    del admin
    return await service.update(media_id, payload)


@router.delete("/media/{media_id}", status_code=204)
async def delete_product_media(media_id: UUID, admin: Admin, service: Service) -> Response:
    del admin
    await service.delete(media_id)
    return Response(status_code=204)
