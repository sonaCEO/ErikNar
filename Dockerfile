FROM ghcr.io/astral-sh/uv:0.12.23 AS uv

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY --from=uv /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY src ./src
COPY alembic.ini ./
COPY migrations ./migrations

RUN useradd --system --uid 10001 --home /nonexistent --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "eriknar.main:app", "--host", "0.0.0.0", "--port", "8000"]
