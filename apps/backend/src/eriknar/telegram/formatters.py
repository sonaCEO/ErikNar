from collections.abc import Mapping
from html import escape
from typing import cast

from eriknar.leads.enums import LeadStatus

_STATUS_MARKER = "\n\n<b>Статус:</b>"
_TOPIC_NAME_LIMIT = 128


def format_lead_number(number: int) -> str:
    return f"№{number:04d}"


def format_topic_name(
    number: int,
    status: LeadStatus,
    model_code: str | None,
    assignee_name: str | None,
) -> str:
    lead_number = format_lead_number(number)
    if status is LeadStatus.NEW:
        subject = f"Модель {model_code}" if model_code else "Консультация"
        return f"🆕 {lead_number} · Новая · {subject}"
    if status is LeadStatus.COMPLETED:
        return f"✅ {lead_number} · Завершена"
    if status is LeadStatus.CANCELLED:
        return f"❌ {lead_number} · Отклонена"

    prefix = f"🟡 {lead_number} · В работе · "  # noqa: RUF001
    assignee = assignee_name or "Не назначена"  # noqa: RUF001
    return prefix + assignee[: _TOPIC_NAME_LIMIT - len(prefix)]


def _name(snapshot: Mapping[str, object], key: str) -> str:
    value = cast(Mapping[str, object], snapshot[key])
    return escape(str(value["name"]))


def _price(price_minor: int, currency: str) -> str:
    amount = price_minor // 100
    symbol = "₽" if currency == "RUB" else currency
    return f"{amount:,}".replace(",", " ") + f" {symbol}"


def format_lead_card(
    *,
    number: int,
    customer_name: str,
    phone: str,
    snapshot: Mapping[str, object] | None,
    comment: str,
) -> str:
    lines = [
        f"<b>Новая заявка {format_lead_number(number)}</b>",
        "",
        f"<b>Клиент:</b> {escape(customer_name)}",
        f"<b>Телефон:</b> <code>{escape(phone)}</code>",
        "",
    ]
    if snapshot is None:
        lines.append("<b>Запрос:</b> Консультация / индивидуальный заказ")
    else:
        lines.extend(
            [
                f"<b>Модель:</b> {escape(str(snapshot['product_name']))}",
                f"<b>Артикул:</b> <code>{escape(str(snapshot['sku']))}</code>",
                f"<b>Размер:</b> {snapshot['height_mm']} × {snapshot['width_mm']} мм",  # noqa: RUF001
                f"<b>Цвет:</b> {_name(snapshot, 'body_color')}",
                f"<b>Панель:</b> {_name(snapshot, 'panel_color')}",
                f"<b>Управление:</b> {_name(snapshot, 'control_type')}",
                f"<b>Цена:</b> "
                f"{_price(int(str(snapshot['price_minor'])), str(snapshot['currency']))}",
            ]
        )
    if comment:
        lines.extend(["", f"<b>Комментарий:</b> {escape(comment)}"])
    return "\n".join(lines)


def format_lead_state(text: str, status: LeadStatus, assignee_name: str | None) -> str:
    """Replaces the status footer while preserving the original lead card."""
    base = text.split(_STATUS_MARKER, maxsplit=1)[0]
    labels = {
        LeadStatus.NEW: "🆕 Новая",
        LeadStatus.IN_PROGRESS: "🟡 В работе",  # noqa: RUF001
        LeadStatus.COMPLETED: "✅ Завершена",
        LeadStatus.CANCELLED: "❌ Отклонена",
    }
    lines = [f"{_STATUS_MARKER} {labels[status]}"]
    if assignee_name:
        lines.append(f"<b>Ответственная:</b> {escape(assignee_name)}")
    return base + "\n".join(lines)


def format_archive_card(
    *,
    number: int,
    status: LeadStatus,
    customer_name: str,
    phone: str,
    snapshot: Mapping[str, object] | None,
    assignee_name: str | None,
    created_at: str,
    closed_at: str,
) -> str:
    status_label = "Завершена" if status is LeadStatus.COMPLETED else "Отклонена"
    lines = [
        f"<b>{format_lead_number(number)} · {status_label}</b>",
        f"<b>Клиент:</b> {escape(customer_name)}",
        f"<b>Телефон:</b> <code>{escape(phone)}</code>",
    ]
    if snapshot is None:
        lines.append("<b>Запрос:</b> Консультация / индивидуальный заказ")
    else:
        lines.extend(
            [
                f"<b>Модель:</b> {escape(str(snapshot['product_name']))}",
                f"<b>Комплектация:</b> <code>{escape(str(snapshot['sku']))}</code>",
            ]
        )
    lines.extend(
        [
            f"<b>Ответственная:</b> {escape(assignee_name or 'Не назначена')}",  # noqa: RUF001
            f"<b>Создана:</b> {escape(created_at)}",
            f"<b>Закрыта:</b> {escape(closed_at)}",
        ]
    )
    return "\n".join(lines)
