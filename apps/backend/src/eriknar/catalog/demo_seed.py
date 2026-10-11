from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from eriknar.catalog.enums import AvailabilityStatus
from eriknar.catalog.models import BodyColor, ControlType, PanelColor, Product, ProductVariant


@dataclass(frozen=True, slots=True)
class SeedResult:
    products_created: int = 0
    variants_created: int = 0
    body_colors_created: int = 0
    panel_colors_created: int = 0
    control_types_created: int = 0

    @property
    def total_created(self) -> int:
        return sum(
            (
                self.products_created,
                self.variants_created,
                self.body_colors_created,
                self.panel_colors_created,
                self.control_types_created,
            )
        )


BODY_COLORS = (
    ("black-matt", "Чёрный матовый", "#20201F"),
    ("steel", "Сталь", "#AAA9A2"),
    ("graphite", "Графит", "#5D5D59"),
    ("white-matt", "Белый матовый", "#EEEAE1"),
    ("gold-matt", "Золото матовое", "#B99B61"),
    ("chrome", "Хром", "#D7D7D7"),
)

PANEL_COLORS = (("black", "Чёрный"), ("white", "Белый"))

CONTROL_TYPES = (
    (
        "electronic-panel",
        "Электронная панель",
        "Таймер на 2, 4 или 6 часов и три режима нагрева.",
    ),
    (
        "touch-panel",
        "Сенсорная панель",
        "Дисплей температуры и таймер.",
    ),
)

PRODUCTS = (
    ("model-a", "Модель A — групповой", "A", ((400, 800), (500, 800), (600, 800)), 12_000_00),
    ("model-b", "Модель B — лесенка", "B", ((400, 800), (500, 800), (600, 800)), 13_000_00),
    ("model-c-slim", "Модель C — вертикальная Slim", "C", ((180, 1200),), 14_000_00),
    ("model-d-frame", "Модель D — вертикальная рамка", "D", ((130, 1200),), 15_000_00),
)


async def _ensure_references(
    session: AsyncSession,
) -> tuple[
    dict[str, BodyColor],
    dict[str, PanelColor],
    dict[str, ControlType],
    tuple[int, int, int],
]:
    body_colors = {item.slug: item for item in (await session.scalars(select(BodyColor))).all()}
    panel_colors = {item.slug: item for item in (await session.scalars(select(PanelColor))).all()}
    control_types = {item.slug: item for item in (await session.scalars(select(ControlType))).all()}
    created = [0, 0, 0]

    for slug, name, hex_value in BODY_COLORS:
        if slug not in body_colors:
            body_color = BodyColor(slug=slug, name=name, hex_value=hex_value)
            session.add(body_color)
            body_colors[slug] = body_color
            created[0] += 1
    for slug, name in PANEL_COLORS:
        if slug not in panel_colors:
            panel_color = PanelColor(slug=slug, name=name)
            session.add(panel_color)
            panel_colors[slug] = panel_color
            created[1] += 1
    for slug, name, description in CONTROL_TYPES:
        if slug not in control_types:
            control_type = ControlType(slug=slug, name=name, description=description)
            session.add(control_type)
            control_types[slug] = control_type
            created[2] += 1
    await session.flush()
    return body_colors, panel_colors, control_types, (created[0], created[1], created[2])


async def seed_demo_catalog(factory: async_sessionmaker[AsyncSession]) -> SeedResult:
    """Добавляет недостающие демоданные, не изменяя уже отредактированные записи."""
    async with factory() as session, session.begin():
        body_colors, panel_colors, control_types, reference_counts = await _ensure_references(
            session
        )
        products = {
            item.model_code: item for item in (await session.scalars(select(Product))).all()
        }
        existing_skus = set((await session.scalars(select(ProductVariant.sku))).all())
        products_created = 0
        variants_created = 0

        for sort_order, (slug, name, model_code, sizes, price_minor) in enumerate(PRODUCTS, 1):
            product = products.get(model_code)
            if product is None:
                product = Product(
                    slug=slug,
                    name=name,
                    model_code=model_code,
                    category="Электрический полотенцесушитель",
                    short_description="Электрический полотенцесушитель ErikNar с крючками.",  # noqa: RUF001
                    description=(
                        "Демонстрационное описание. Электрический полотенцесушитель "
                        "с сухим ТЭНом, максимальной температурой нагрева 60 °C и крючками. "  # noqa: RUF001
                        "Финальный текст и цену заказчик сможет изменить в панели управления."
                    ),
                    max_temperature=60,
                    heater_type="Сухой ТЭН",
                    warranty_months=24,
                    sort_order=sort_order,
                    is_published=True,
                )
                session.add(product)
                await session.flush()
                products[model_code] = product
                products_created += 1

            for width_mm, height_mm in sizes:
                for body_slug, _, _ in BODY_COLORS:
                    for control_slug, _, _ in CONTROL_TYPES:
                        for panel_slug, _ in PANEL_COLORS:
                            sku = (
                                f"EN-{model_code}-{height_mm}X{width_mm}-"
                                f"{body_slug}-{control_slug}-{panel_slug}"
                            ).upper()
                            if sku in existing_skus:
                                continue
                            session.add(
                                ProductVariant(
                                    product_id=product.id,
                                    sku=sku,
                                    width_mm=width_mm,
                                    height_mm=height_mm,
                                    body_color_id=body_colors[body_slug].id,
                                    control_type_id=control_types[control_slug].id,
                                    panel_color_id=panel_colors[panel_slug].id,
                                    price_minor=price_minor,
                                    currency="RUB",
                                    availability_status=AvailabilityStatus.IN_STOCK,
                                    is_active=True,
                                )
                            )
                            existing_skus.add(sku)
                            variants_created += 1

    return SeedResult(
        products_created=products_created,
        variants_created=variants_created,
        body_colors_created=reference_counts[0],
        panel_colors_created=reference_counts[1],
        control_types_created=reference_counts[2],
    )
