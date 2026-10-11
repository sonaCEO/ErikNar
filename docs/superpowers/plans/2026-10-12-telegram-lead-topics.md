# Telegram Lead Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every lead a short sequential number, keep active leads in clearly named Telegram topics, and archive terminal leads after 24 hours.

**Architecture:** PostgreSQL owns lead numbering and schedules archive work through the existing transactional outbox. Telegram callbacks update the card and topic immediately; the outbox worker later writes one summary to a configured archive topic and closes the original topic with retry-safe state stored on the lead.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL 16, aiogram 3, pytest.

**Spec:** `docs/superpowers/specs/2026-10-12-telegram-lead-topics-design.md`

## Global Constraints

- Display lead numbers as `№0007`; keep `public_id` unchanged for compatibility.
- Active topics are separate; terminal topics remain open for 24 hours.
- Archiving posts a summary to the shared `Архив` topic and closes, never deletes, the original topic.
- External Telegram operations must not be repeated blindly after an ambiguous database failure.
- Existing leads receive deterministic numbers ordered by `created_at, id`.

## Review Focus

- Two leads created concurrently must receive different numbers; Task 1 adds a concurrency test.
- An existing production database with leads must migrate without null or duplicate numbers; Task 1 adds a migration test.
- Reprocessing an archive event after the archive message ID was saved must not post a duplicate; Task 4 adds a recovery test.
- A Telegram failure after posting but before persisting the message ID must require manual review; Task 4 adds an ambiguity test.
- Admin-driven terminal transitions must schedule the same archive operation as Telegram transitions; Task 4 tests both services.

---

### Task 1: Sequential Lead Numbers

**Files:**
- Create: `apps/backend/migrations/versions/0007_lead_numbers_and_archive.py`
- Modify: `apps/backend/src/eriknar/leads/models.py`
- Modify: `apps/backend/src/eriknar/leads/schemas.py`
- Modify: `apps/backend/src/eriknar/leads/admin_schemas.py`
- Modify: `apps/backend/src/eriknar/leads/admin_service.py`
- Test: `apps/backend/tests/integration/test_lead_number_migration.py`
- Test: `apps/backend/tests/leads/test_lead_service.py`
- Test: `apps/backend/tests/api/test_leads_api.py`

**Interfaces:**
- Consumes: existing `Lead.public_id`, creation transaction, and admin view builders.
- Produces: `Lead.number: int`, `CreateLeadResponse.number: int`, `AdminLeadView.number: int`, sequence `lead_number_seq`.

- [ ] **Step 1: Write failing migration and concurrency tests** asserting deterministic backfill and distinct numbers for simultaneous lead creation.
- [ ] **Step 2: Run targeted tests** with `uv run pytest tests/integration/test_lead_number_migration.py tests/leads/test_lead_service.py -q`; expect missing column/schema failures.
- [ ] **Step 3: Add migration `0007` and model field** using a PostgreSQL sequence, unique index, ordered backfill, and non-null constraint.
- [ ] **Step 4: Add `number` to public and admin response schemas** without removing `public_id`.
- [ ] **Step 5: Run targeted tests** with `uv run pytest tests/integration/test_lead_number_migration.py tests/leads/test_lead_service.py tests/api/test_leads_api.py -q`; expect PASS.
- [ ] **Step 6: Commit** with `git commit -m "feat: add sequential lead numbers"`.

### Task 2: Topic Names and Card Numbers

**Files:**
- Modify: `apps/backend/src/eriknar/telegram/formatters.py`
- Modify: `apps/backend/src/eriknar/outbox/processor.py`
- Modify: `apps/backend/tests/telegram/test_lead_publication.py`
- Modify: `apps/backend/tests/e2e/test_lead_to_telegram.py`

**Interfaces:**
- Consumes: `Lead.number`, `Lead.status`, snapshot model code, assignee name.
- Produces: `format_topic_name(number: int, status: LeadStatus, model_code: str, assignee_name: str | None) -> str`; `format_lead_card(..., number: int, ...) -> str`.

- [ ] **Step 1: Write failing formatter tests** for `🆕 №0007 · Новая · Модель B`, `🟡 №0007 · В работе · Сона`, and both terminal names, including Telegram's 128-character topic-name limit.
- [ ] **Step 2: Run formatter tests** with `uv run pytest tests/telegram/test_lead_publication.py -q`; expect missing signature/function failures.
- [ ] **Step 3: Implement number formatting and topic-name formatting**, truncating only the assignee portion when required.
- [ ] **Step 4: Use the short number in new topic names and cards** while retaining the UUID only in backend/API data.
- [ ] **Step 5: Run Telegram publication and e2e tests** with `uv run pytest tests/telegram/test_lead_publication.py tests/e2e/test_lead_to_telegram.py -q`; expect PASS.
- [ ] **Step 6: Commit** with `git commit -m "feat: label Telegram topics with lead numbers"`.

### Task 3: Rename Topics on Manager Actions

**Files:**
- Modify: `apps/backend/src/eriknar/telegram/client.py`
- Modify: `apps/backend/src/eriknar/telegram/handlers.py`
- Modify: `apps/backend/src/eriknar/telegram/worker.py`
- Modify: `apps/backend/tests/telegram/test_manager_claim.py`
- Create: `apps/backend/tests/telegram/test_topic_updates.py`

**Interfaces:**
- Consumes: Task 2 `format_topic_name`; `LeadActionResult`; manager chat ID and `Bot` from the worker.
- Produces: `TelegramTopicGateway.rename_topic(topic_id: int, name: str) -> None`; handler updates card and topic after a committed action.

- [ ] **Step 1: Write failing gateway and handler tests** proving claim and terminal actions rename the topic, remove invalid buttons, and do not rename after a rejected transition.
- [ ] **Step 2: Run tests** with `uv run pytest tests/telegram/test_manager_claim.py tests/telegram/test_topic_updates.py -q`; expect missing gateway behavior.
- [ ] **Step 3: Implement topic rename in `AiogramTelegramGateway`** and inject the gateway into `build_router` from `worker.py`.
- [ ] **Step 4: Return the lead number, model code, topic ID, and assignee name from the manager action layer**, then edit card and topic only after the database commit succeeds.
- [ ] **Step 5: Run Telegram tests** with `uv run pytest tests/telegram -q`; expect PASS.
- [ ] **Step 6: Commit** with `git commit -m "feat: rename lead topics on status changes"`.

### Task 4: Delayed Archive Through the Outbox

**Files:**
- Modify: `apps/backend/migrations/versions/0007_lead_numbers_and_archive.py`
- Modify: `apps/backend/src/eriknar/core/config.py`
- Modify: `apps/backend/src/eriknar/leads/models.py`
- Modify: `apps/backend/src/eriknar/leads/service.py`
- Modify: `apps/backend/src/eriknar/leads/admin_service.py`
- Modify: `apps/backend/src/eriknar/outbox/models.py`
- Modify: `apps/backend/src/eriknar/outbox/processor.py`
- Modify: `apps/backend/src/eriknar/telegram/client.py`
- Modify: `.env.example`
- Modify: `.env.demo.example`
- Test: `apps/backend/tests/integration/test_lead_archive.py`
- Test: `apps/backend/tests/integration/test_outbox_retry.py`
- Modify: `apps/backend/tests/catalog/test_admin_catalog_service.py` only if shared fixtures require the new settings field.

**Interfaces:**
- Consumes: `Lead.number`, terminal `closed_at`, existing `OutboxRepository.claim_next`, configured `telegram_archive_topic_id`.
- Produces: `Lead.telegram_archive_message_id: int | None`, `Lead.telegram_archived_at: datetime | None`; event type `lead.archive_due`; gateway methods `send_archive_card(text: str) -> int` and `close_topic(topic_id: int) -> None`.

- [ ] **Step 1: Write failing service tests** proving Telegram and admin terminal transitions create exactly one `lead.archive_due` event with `next_attempt_at = closed_at + 24h`.
- [ ] **Step 2: Write failing processor tests** proving the event is ignored before it is due, posts once afterward, closes only after posting, resumes from a saved archive message ID, and marks ambiguous persistence failures `requires_review`.
- [ ] **Step 3: Run archive tests** with `uv run pytest tests/integration/test_lead_archive.py tests/integration/test_outbox_retry.py -q`; expect missing fields/event handling.
- [ ] **Step 4: Add archive persistence fields and the outbox uniqueness constraint** in migration `0007`, plus ORM/config fields.
- [ ] **Step 5: Schedule the archive event inside both terminal transition transactions** using one shared helper that tolerates an existing event.
- [ ] **Step 6: Extend the Telegram gateway and outbox processor** to format one archive summary, send it to `ERIKNAR_TELEGRAM_ARCHIVE_TOPIC_ID`, persist its message ID, close the source topic, and set `telegram_archived_at`.
- [ ] **Step 7: Run archive and full backend tests** with `uv run pytest tests/integration/test_lead_archive.py tests/integration/test_outbox_retry.py -q && uv run pytest -q`; expect PASS.
- [ ] **Step 8: Commit** with `git commit -m "feat: archive terminal Telegram lead topics"`.

### Task 5: Documentation and Live Verification

**Files:**
- Modify: `apps/backend/README.md`
- Modify: `apps/backend/FRONTEND_API.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all prior tasks and the test group configuration.
- Produces: setup instructions for the archive topic and updated JSON examples containing `number`.

- [ ] **Step 1: Update documentation** with `ERIKNAR_TELEGRAM_ARCHIVE_TOPIC_ID`, number semantics, topic lifecycle, and local start/stop commands.
- [ ] **Step 2: Create the `Архив` topic in the test group**, record its ID only in the protected local runtime environment, and restart the local worker.
- [ ] **Step 3: Run static and automated verification** with `uv run ruff check src tests && uv run mypy src tests && uv run alembic check && uv run pytest -q`; expect all commands to pass.
- [ ] **Step 4: Run a live Telegram test** with an accelerated test-only archive delay: create, claim, finish, verify archive summary and source-topic closure, then restore the 24-hour setting.
- [ ] **Step 5: Commit and push** with `git commit -m "docs: describe Telegram lead archive"` and `git push origin dev`.
