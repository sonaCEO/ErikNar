from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from eriknar.catalog.admin_service import (
    AdminCatalogNotFoundError,
    CatalogConflictError,
    ConcurrentUpdateError,
)
from eriknar.catalog.models import BodyColor, Product, ProductMedia, ProductVariant
from eriknar.media.admin_schemas import AdminMediaView, UpdateMediaCommand
from eriknar.media.cleanup_models import PendingMediaDeletion
from eriknar.media.service import MediaService
from eriknar.media.storage import ObjectStorage


class AdminMediaNotFoundError(ValueError):
    pass


class AdminMediaService:
    def __init__(
        self,
        *,
        session: AsyncSession,
        storage: ObjectStorage,
        bucket: str,
        max_size_bytes: int,
    ) -> None:
        self._session = session
        self._storage = storage
        self._media = MediaService(
            storage=storage,
            bucket=bucket,
            max_size_bytes=max_size_bytes,
        )

    @property
    def max_upload_size(self) -> int:
        return self._media.max_size_bytes

    async def upload(
        self,
        *,
        product_id: UUID,
        content: bytes,
        content_type: str,
        alt_text: str,
        sort_order: int,
        is_primary: bool,
        variant_id: UUID | None,
        body_color_id: UUID | None,
    ) -> AdminMediaView:
        async with self._session.begin():
            await self._require_scope(product_id, variant_id, body_color_id)
        media = await self._media.store_product_image(
            product_id=product_id,
            content=content,
            content_type=content_type,
            alt_text=alt_text,
            sort_order=sort_order,
            variant_id=variant_id,
            body_color_id=body_color_id,
        )
        media.is_primary = is_primary
        try:
            async with self._session.begin():
                if is_primary:
                    await self._clear_primary(product_id, variant_id, body_color_id)
                self._session.add(media)
                await self._session.flush()
        except IntegrityError as exc:
            await self._storage.delete(media.bucket, media.object_key)
            raise CatalogConflictError from exc
        except Exception:
            await self._storage.delete(media.bucket, media.object_key)
            raise
        return self._view(media)

    async def list_for_product(self, product_id: UUID) -> list[AdminMediaView]:
        if await self._session.get(Product, product_id) is None:
            raise AdminCatalogNotFoundError(product_id)
        result = await self._session.scalars(
            select(ProductMedia)
            .where(ProductMedia.product_id == product_id)
            .order_by(ProductMedia.sort_order, ProductMedia.created_at, ProductMedia.id)
        )
        return [self._view(item) for item in result]

    async def update(self, media_id: UUID, command: UpdateMediaCommand) -> AdminMediaView:
        values = command.model_dump(exclude={"expected_updated_at"}, exclude_none=True)
        values["updated_at"] = datetime.now(UTC)
        try:
            async with self._session.begin():
                media = await self._session.scalar(
                    update(ProductMedia)
                    .where(
                        ProductMedia.id == media_id,
                        ProductMedia.updated_at == command.expected_updated_at,
                    )
                    .values(**values)
                    .returning(ProductMedia)
                )
                if media is None:
                    if await self._session.get(ProductMedia, media_id) is None:
                        raise AdminMediaNotFoundError(media_id)
                    raise ConcurrentUpdateError(media_id)
                if command.is_primary is True:
                    await self._clear_primary(
                        media.product_id,
                        media.variant_id,
                        media.body_color_id,
                        exclude_id=media.id,
                    )
        except IntegrityError as exc:
            raise CatalogConflictError from exc
        return self._view(media)

    async def delete(self, media_id: UUID) -> None:
        async with self._session.begin():
            media = await self._session.get(ProductMedia, media_id)
            if media is None:
                raise AdminMediaNotFoundError(media_id)
            pending = PendingMediaDeletion(bucket=media.bucket, object_key=media.object_key)
            await self._session.delete(media)
            self._session.add(pending)

        try:
            await self._storage.delete(pending.bucket, pending.object_key)
        except Exception:
            return

        async with self._session.begin():
            await self._session.execute(
                delete(PendingMediaDeletion).where(PendingMediaDeletion.id == pending.id)
            )

    async def _require_scope(
        self,
        product_id: UUID,
        variant_id: UUID | None,
        body_color_id: UUID | None,
    ) -> None:
        if await self._session.get(Product, product_id) is None:
            raise AdminCatalogNotFoundError(product_id)
        if variant_id is not None:
            variant_product_id = await self._session.scalar(
                select(ProductVariant.product_id).where(ProductVariant.id == variant_id)
            )
            if variant_product_id != product_id:
                raise AdminCatalogNotFoundError(variant_id)
        if body_color_id is not None and await self._session.get(BodyColor, body_color_id) is None:
            raise AdminCatalogNotFoundError(body_color_id)

    async def _clear_primary(
        self,
        product_id: UUID,
        variant_id: UUID | None,
        body_color_id: UUID | None,
        *,
        exclude_id: UUID | None = None,
    ) -> None:
        statement = update(ProductMedia).where(
            ProductMedia.product_id == product_id,
            ProductMedia.variant_id.is_not_distinct_from(variant_id),
            ProductMedia.body_color_id.is_not_distinct_from(body_color_id),
            ProductMedia.is_primary.is_(True),
        )
        if exclude_id is not None:
            statement = statement.where(ProductMedia.id != exclude_id)
        await self._session.execute(
            statement.values(is_primary=False, updated_at=datetime.now(UTC))
        )

    def _view(self, media: ProductMedia) -> AdminMediaView:
        return AdminMediaView(
            id=media.id,
            product_id=media.product_id,
            variant_id=media.variant_id,
            body_color_id=media.body_color_id,
            url=self._storage.public_url(media.bucket, media.object_key),
            mime_type=media.mime_type,
            size_bytes=media.size_bytes,
            alt_text=media.alt_text,
            sort_order=media.sort_order,
            is_primary=media.is_primary,
            created_at=media.created_at,
            updated_at=media.updated_at,
        )
