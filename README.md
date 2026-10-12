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

`compose.demo.yaml` собирает frontend и backend, применяет миграции и добавляет
демокаталог. По умолчанию стенд доступен на сервере по `http://127.0.0.1:18080`.

```bash
cp .env.demo.example .env.demo
# замените все значения replace-... на случайные секреты
docker compose --env-file .env.demo -f compose.demo.yaml up -d --build
```

При необходимости Cloudflare Quick Tunnel включается отдельным профилем. Адрес вида
`https://...trycloudflare.com` появится в логах и может измениться после перезапуска:

```bash
docker compose --env-file .env.demo -f compose.demo.yaml --profile cloudflare up -d tunnel
docker compose --env-file .env.demo -f compose.demo.yaml logs tunnel
```

Telegram-воркер запускается отдельно, когда токен и ID рабочей группы заполнены:

```bash
docker compose --env-file .env.demo -f compose.demo.yaml --profile telegram up -d
```

Для работы архива в `.env.demo` также указывается
`ERIKNAR_TELEGRAM_ARCHIVE_TOPIC_ID` — ID заранее созданной темы «Архив». Активные
заявки находятся в отдельных темах по коротким номерам, а через 24 часа после
завершения или отклонения исходная тема закрывается.

Остановка Telegram-воркера:

```bash
docker compose --env-file .env.demo -f compose.demo.yaml --profile telegram stop telegram-worker
```
