# ErikNar backend

Backend каталога полотенцесушителей ErikNar: публичный JSON API, PostgreSQL,
хранение изображений в MinIO и Telegram-воркер для заявок менеджерам.

## Что нужно установить

- Docker с Compose v2 — для обычного запуска всего проекта;
- либо Python 3.12 и [uv](https://docs.astral.sh/uv/) — для локальной разработки;
- Telegram-супергруппа с включёнными темами и бот, добавленный в неё администратором.

## Настройка окружения

Из корня проекта:

```bash
cp .env.example .env
```

Замените пароли, `ERIKNAR_TELEGRAM_BOT_TOKEN` и
`ERIKNAR_TELEGRAM_MANAGER_CHAT_ID`. ID супергруппы обычно начинается с `-100`.
Секреты хранятся только в `.env`; этот файл исключён из Git.

## Запуск через Docker Compose

```bash
docker compose up --build
```

Сервис `migrate` сначала применяет миграции, затем запускаются API и Telegram-воркер.
После старта доступны:

- API: `http://localhost:8000/api/v1`;
- OpenAPI/Swagger: `http://localhost:8000/docs`;
- liveness: `http://localhost:8000/api/v1/health`;
- readiness PostgreSQL и MinIO: `http://localhost:8000/api/v1/ready`;
- консоль MinIO: `http://localhost:9001`.

Остановка:

```bash
docker compose down
```

Данные PostgreSQL и MinIO сохраняются в именованных Docker volumes. Команда
`docker compose down -v` удалит их вместе с данными.

## Локальная разработка

```bash
uv sync --frozen
uv run alembic upgrade head
uv run uvicorn eriknar.main:app --reload
```

В отдельном терминале запускается Telegram-воркер:

```bash
uv run python -m eriknar.telegram.worker
```

При запуске без Compose укажите доступные с компьютера адреса PostgreSQL и MinIO
в `ERIKNAR_DATABASE_URL`, `ERIKNAR_MINIO_ENDPOINT` и
`ERIKNAR_MEDIA_PUBLIC_BASE_URL`.

## Telegram

1. Создайте бота через BotFather и сохраните токен в `.env`.
2. Преобразуйте рабочую группу в супергруппу, включите темы.
3. Добавьте бота администратором с правами создавать темы и отправлять сообщения.
4. Запишите ID группы в `ERIKNAR_TELEGRAM_MANAGER_CHAT_ID`.
5. Добавьте сотрудниц в таблицу `users`, указав их числовые Telegram ID и
   `is_active=true`. Неизвестные и отключённые пользователи не могут менять заявки.

Каждая новая заявка создаёт тему и карточку с кнопками «Взять в работу»,
«Завершить» и «Отклонить». Доставка идёт через транзакционную очередь с повторными
попытками; после перезапуска воркер подбирает зависшие события.

## JSON-контракт

Основные маршруты:

- `GET /api/v1/catalog/products`;
- `GET /api/v1/catalog/products/{slug}`;
- `POST /api/v1/leads` с обязательным заголовком `Idempotency-Key`.

Цена передаётся целым числом `price_minor` в копейках, валюта — `RUB`. Повторный
запрос с тем же ключом и телом возвращает исходную заявку. Точный контракт и модели
ответов публикуются в `/openapi.json` и `/docs`.

## Проверки

```bash
uv run ruff check .
uv run mypy src tests
uv run pytest -v
```

Интеграционные тесты сами запускают временные PostgreSQL 16 и MinIO. Для них в
проекте предусмотрен `.mise.toml`; при использовании другого менеджера установите
соответствующие бинарные файлы самостоятельно.

Проверка миграций на пустой тестовой базе:

```bash
uv run alembic upgrade head
uv run alembic check
```
