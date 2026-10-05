import asyncio

from httpx import ASGITransport, AsyncClient

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
