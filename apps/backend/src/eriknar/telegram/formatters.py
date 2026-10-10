from collections.abc import Mapping
from html import escape
from typing import cast


def _name(snapshot: Mapping[str, object], key: str) -> str:
    value = cast(Mapping[str, object], snapshot[key])
    return escape(str(value["name"]))


def _price(price_minor: int, currency: str) -> str:
    amount = price_minor // 100
    symbol = "₽" if currency == "RUB" else currency
    return f"{amount:,}".replace(",", " ") + f" {symbol}"


def format_lead_card(
    *,
    public_id: str,
    customer_name: str,
    phone: str,
    snapshot: Mapping[str, object],
    comment: str,
) -> str:
    lines = [
        f"<b>Новая заявка</b> <code>{escape(public_id)}</code>",
        "",
        f"<b>Клиент:</b> {escape(customer_name)}",
        f"<b>Телефон:</b> <code>{escape(phone)}</code>",
        "",
        f"<b>Модель:</b> {escape(str(snapshot['product_name']))}",
        f"<b>Артикул:</b> <code>{escape(str(snapshot['sku']))}</code>",
        f"<b>Размер:</b> {snapshot['height_mm']} × {snapshot['width_mm']} мм",  # noqa: RUF001
        f"<b>Цвет:</b> {_name(snapshot, 'body_color')}",
        f"<b>Панель:</b> {_name(snapshot, 'panel_color')}",
        f"<b>Управление:</b> {_name(snapshot, 'control_type')}",
        f"<b>Цена:</b> {_price(int(str(snapshot['price_minor'])), str(snapshot['currency']))}",
    ]
    if comment:
        lines.extend(["", f"<b>Комментарий:</b> {escape(comment)}"])
    return "\n".join(lines)
