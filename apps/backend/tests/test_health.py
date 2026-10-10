import asyncio

from httpx import ASGITransport, AsyncClient

from eriknar.api.router import get_readiness
from eriknar.main import create_app


def test_health_returns_ok() -> None:
    async def request_health() -> tuple[int, dict[str, str]]:
        async with AsyncClient(
            transport=ASGITransport(app=create_app()), base_url="http://testserver"
        ) as client:
            response = await client.get("/api/v1/health")
            return response.status_code, response.json()

    status_code, payload = asyncio.run(request_health())

    assert status_code == 200
    assert payload == {"status": "ok"}


def test_request_id_is_generated_or_propagated() -> None:
    async def request_ids() -> tuple[str | None, str | None]:
        async with AsyncClient(
            transport=ASGITransport(app=create_app()), base_url="http://testserver"
        ) as client:
            generated = await client.get("/api/v1/health")
            propagated = await client.get(
                "/api/v1/health", headers={"X-Request-ID": "browser-request-123"}
            )
            return generated.headers.get("X-Request-ID"), propagated.headers.get("X-Request-ID")

    generated, propagated = asyncio.run(request_ids())

    assert generated is not None
    assert propagated == "browser-request-123"


def test_request_logger_is_enabled() -> None:
    import logging

    create_app()

    assert logging.getLogger("eriknar.http").isEnabledFor(logging.INFO)


def test_readiness_reports_dependency_state() -> None:
    async def request_ready() -> tuple[int, dict[str, object]]:
        app = create_app()
        app.dependency_overrides[get_readiness] = lambda: {
            "status": "ok",
            "checks": {"postgres": "ok", "minio": "ok"},
        }
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.get("/api/v1/ready")
            return response.status_code, response.json()

    status_code, payload = asyncio.run(request_ready())

    assert status_code == 200
    assert payload == {"status": "ok", "checks": {"postgres": "ok", "minio": "ok"}}
