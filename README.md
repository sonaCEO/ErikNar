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

## Публичный демостенд

`compose.demo.yaml` собирает frontend и backend, применяет миграции, добавляет
демокаталог и запускает временный публичный адрес через Cloudflare Quick Tunnel.

```bash
cp .env.demo.example .env.demo
# замените все значения replace-... на случайные секреты
docker compose --env-file .env.demo -f compose.demo.yaml up -d --build
docker compose --env-file .env.demo -f compose.demo.yaml logs tunnel
```

Адрес вида `https://...trycloudflare.com` появится в логах `tunnel`. Он временный и
может измениться после пересоздания контейнера. Telegram-воркер запускается отдельно,
когда токен и ID рабочей группы заполнены:

```bash
docker compose --env-file .env.demo -f compose.demo.yaml --profile telegram up -d
```
