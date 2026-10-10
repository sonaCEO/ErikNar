# ErikNar

Монорепозиторий сайта-каталога полотенцесушителей ErikNar.

- `apps/frontend` — клиентская часть на React;
- `apps/backend` — FastAPI, PostgreSQL, S3-совместимое хранилище и Telegram-бот;
- `compose.yaml` — локальный запуск инфраструктуры и backend-сервисов.

## Запуск backend

```bash
cp .env.example .env
docker compose up --build
```

API будет доступен на `http://localhost:8000`, Swagger — на
`http://localhost:8000/docs`. Подробности находятся в
[`apps/backend/README.md`](apps/backend/README.md), памятка для интеграции фронта —
в [`apps/backend/FRONTEND_API.md`](apps/backend/FRONTEND_API.md).

## Запуск frontend

```bash
npm install --prefix apps/frontend
npm run dev:frontend
```
