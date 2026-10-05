from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from eriknar.catalog.service import ProductNotFoundError


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

    @app.exception_handler(Exception)
    async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
        del request, exc
        payload = ErrorResponse(
            error=ErrorDetail(code="internal_error", message="Внутренняя ошибка сервера")
        )
        return JSONResponse(status_code=500, content=payload.model_dump(mode="json"))
