from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from eriknar.catalog.admin_service import (
    AdminCatalogNotFoundError,
    CatalogConflictError,
    ConcurrentUpdateError,
)
from eriknar.catalog.service import ProductNotFoundError
from eriknar.leads.service import (
    IdempotencyConflictError,
    InvalidPhoneError,
    VariantUnavailableError,
)
from eriknar.users.dependencies import AuthenticationError, PermissionDeniedError
from eriknar.users.service import (
    EmployeeNotFoundError,
    InvalidCredentialsError,
    LoginConflictError,
    LoginRateLimitedError,
)


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: ErrorDetail


def install_exception_handlers(app: FastAPI) -> None:
    def error(status_code: int, code: str, message: str) -> JSONResponse:
        payload = ErrorResponse(error=ErrorDetail(code=code, message=message))
        return JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))

    @app.exception_handler(InvalidCredentialsError)
    async def invalid_credentials_handler(
        request: Request, exc: InvalidCredentialsError
    ) -> JSONResponse:
        del request, exc
        return error(401, "invalid_credentials", "Неверный логин или пароль")

    @app.exception_handler(AuthenticationError)
    async def authentication_handler(request: Request, exc: AuthenticationError) -> JSONResponse:
        del request, exc
        return error(401, "invalid_access_token", "Требуется повторный вход")

    @app.exception_handler(PermissionDeniedError)
    async def permission_handler(request: Request, exc: PermissionDeniedError) -> JSONResponse:
        del request, exc
        return error(403, "forbidden", "Недостаточно прав")

    @app.exception_handler(LoginRateLimitedError)
    async def login_rate_limited_handler(
        request: Request, exc: LoginRateLimitedError
    ) -> JSONResponse:
        del request, exc
        return error(429, "login_rate_limited", "Слишком много попыток входа")

    @app.exception_handler(LoginConflictError)
    async def login_conflict_handler(request: Request, exc: LoginConflictError) -> JSONResponse:
        del request, exc
        return error(409, "login_conflict", "Этот логин уже используется")

    @app.exception_handler(EmployeeNotFoundError)
    async def employee_not_found_handler(
        request: Request, exc: EmployeeNotFoundError
    ) -> JSONResponse:
        del request, exc
        return error(404, "employee_not_found", "Сотрудник не найден")

    @app.exception_handler(ProductNotFoundError)
    async def product_not_found_handler(
        request: Request, exc: ProductNotFoundError
    ) -> JSONResponse:
        del request, exc
        payload = ErrorResponse(
            error=ErrorDetail(code="product_not_found", message="Товар не найден")
        )
        return JSONResponse(status_code=404, content=payload.model_dump(mode="json"))

    @app.exception_handler(AdminCatalogNotFoundError)
    async def admin_catalog_not_found_handler(
        request: Request, exc: AdminCatalogNotFoundError
    ) -> JSONResponse:
        del request, exc
        return error(404, "admin_catalog_not_found", "Запись каталога не найдена")

    @app.exception_handler(ConcurrentUpdateError)
    async def concurrent_update_handler(
        request: Request, exc: ConcurrentUpdateError
    ) -> JSONResponse:
        del request, exc
        return error(409, "concurrent_update", "Запись уже изменена")

    @app.exception_handler(CatalogConflictError)
    async def catalog_conflict_handler(request: Request, exc: CatalogConflictError) -> JSONResponse:
        del request, exc
        return error(409, "catalog_conflict", "Конфликт данных каталога")

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
