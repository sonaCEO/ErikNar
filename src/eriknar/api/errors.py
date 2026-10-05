from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from eriknar.catalog.service import ProductNotFoundError
from eriknar.leads.service import (
    IdempotencyConflictError,
    InvalidPhoneError,
    VariantUnavailableError,
)


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorDetail


def install_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProductNotFoundError)
    async def product_not_found_handler(
        request: Request, exc: ProductNotFoundError
    ) -> JSONResponse:
        del request, exc
        payload = ErrorResponse(
            error=ErrorDetail(code="product_not_found", message="Товар не найден")
        )
        return JSONResponse(status_code=404, content=payload.model_dump(mode="json"))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        del request
        payload = ErrorResponse(
            error=ErrorDetail(
                code="validation_error",
                message="Некорректные данные запроса",
                details={"errors": jsonable_encoder(exc.errors())},
            )
        )
        return JSONResponse(status_code=422, content=payload.model_dump(mode="json"))

    @app.exception_handler(IdempotencyConflictError)
    async def idempotency_conflict_handler(
        request: Request, exc: IdempotencyConflictError
    ) -> JSONResponse:
        del request, exc
        payload = ErrorResponse(
            error=ErrorDetail(
                code="idempotency_conflict",
                message="Ключ повторного запроса уже использован с другими данными",  # noqa: RUF001
            )
        )
        return JSONResponse(status_code=409, content=payload.model_dump(mode="json"))

    @app.exception_handler(VariantUnavailableError)
    async def variant_unavailable_handler(
        request: Request, exc: VariantUnavailableError
    ) -> JSONResponse:
        del request, exc
        payload = ErrorResponse(
            error=ErrorDetail(
                code="variant_unavailable",
                message="Выбранная комплектация недоступна",
            )
        )
        return JSONResponse(status_code=409, content=payload.model_dump(mode="json"))

    @app.exception_handler(InvalidPhoneError)
    async def invalid_phone_handler(request: Request, exc: InvalidPhoneError) -> JSONResponse:
        del request, exc
        payload = ErrorResponse(
            error=ErrorDetail(
                code="invalid_phone",
                message="Укажите корректный номер телефона",
            )
        )
        return JSONResponse(status_code=422, content=payload.model_dump(mode="json"))

    @app.exception_handler(Exception)
    async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
        del request, exc
        payload = ErrorResponse(
            error=ErrorDetail(code="internal_error", message="Внутренняя ошибка сервера")
        )
        return JSONResponse(status_code=500, content=payload.model_dump(mode="json"))
