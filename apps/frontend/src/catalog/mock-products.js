import productImage from "../assets/product/product-img.jpg";
import bathroomImage from "../assets/spaces/bathroom.jpg";
import laundryImage from "../assets/spaces/laundry.jpg";
import customImage from "../assets/custom/custom-img.jpg";
import {AvailabilityStatus} from "./availability";

const BODY_COLORS = [
		{id: "bc-black", slug: "black-matt", name: "Чёрный матовый", hex_value: "#20201F"},
		{id: "bc-steel", slug: "steel", name: "Сталь", hex_value: "#AAA9A2"},
		{id: "bc-graphite", slug: "graphite", name: "Графит", hex_value: "#5D5D59"},
		{id: "bc-white", slug: "white-matt", name: "Белый матовый", hex_value: "#EEEAE1"},
		{id: "bc-gold", slug: "gold-matt", name: "Золото матовое", hex_value: "#B99B61"},
];

const PANEL_COLOR = {id: "pc-black", slug: "black", name: "Чёрный"};

const CONTROL_TYPES = [
		{
				id: "ct-electronic",
				slug: "electronic-panel",
				name: "Электронная",
				description: "Таймер 2 / 4 / 6 ч и три режима нагрева",
		},
		{
				id: "ct-touch",
				slug: "touch-panel",
				name: "Сенсорная",
				description: "Дисплей температуры и таймер",
		},
];

const GALLERY = [
		{id: "m1", url: productImage, alt_text: "Полотенцесушитель, общий вид", sort_order: 0, is_primary: true},
		{id: "m2", url: bathroomImage, alt_text: "В интерьере ванной", sort_order: 1, is_primary: false},
		{id: "m3", url: laundryImage, alt_text: "В зоне сушки", sort_order: 2, is_primary: false},
		{id: "m4", url: customImage, alt_text: "Крупный план покрытия", sort_order: 3, is_primary: false},
];

const PRODUCT_DEFS = [
		{
				slug: "model-a",
				name: "Модель A · Групповой",
				model_code: "A",
				type: "group",
				short_description: "Секции собраны группами — больше полотенец при спокойном ритме линий.",
				description: "Геометрия горизонтальных секций для ежедневной сушки. Сухой ТЭН, настенный монтаж, комплектация с крючками и креплениями.",
				sizes: [[400, 800], [500, 800], [600, 800]],
				price_minor: 12_600_00,
		},
		{
				slug: "model-b",
				name: "Модель B · Лесенка",
				model_code: "B",
				type: "ladder",
				short_description: "Классическая лесенка с ровным шагом перекладин.",
				description: "Универсальная лесенка для ежедневного тепла. Сухой ТЭН, матовое покрытие, крючки в комплекте.",
				sizes: [[400, 800], [500, 800], [600, 800]],
				price_minor: 13_000_00,
		},
		{
				slug: "model-c-slim",
				name: "Модель C · Slim",
				model_code: "C",
				type: "vertical",
				short_description: "Узкий вертикальный профиль, когда важны сантиметры стены.",
				description: "Вертикальный Slim для компактных ванных. Сухой ТЭН, настенный монтаж.",
				sizes: [[180, 1200]],
				price_minor: 14_000_00,
		},
		{
				slug: "model-d-frame",
				name: "Модель D · Рамка",
				model_code: "D",
				type: "vertical",
				short_description: "Рамная конструкция с акцентом на геометрию.",
				description: "Вертикальная рамка как акцент стены. Сухой ТЭН, матовое покрытие.",
				sizes: [[130, 1200]],
				price_minor: 15_000_00,
		},
];

function buildVariants(def) {
		const variants = [];
		let index = 0;

		for (const [width_mm, height_mm] of def.sizes) {
				for (const body_color of BODY_COLORS) {
						for (const control_type of CONTROL_TYPES) {
								index += 1;
								variants.push({
										id: `var-${def.model_code}-${index}`,
										sku: `EN-${def.model_code}-${height_mm}X${width_mm}-${body_color.slug}-${control_type.slug}-BLACK`.toUpperCase(),
										width_mm,
										height_mm,
										price_minor: def.price_minor,
										currency: "RUB",
										availability_status: AvailabilityStatus.IN_STOCK,
										body_color,
										panel_color: PANEL_COLOR,
										control_type,
										media: GALLERY.map((item) => ({
												...item,
												id: `${item.id}-${def.model_code}-${index}`,
												alt_text: `${def.name}: ${item.alt_text}`,
										})),
								});
						}
				}
		}

		return variants;
}

function buildProduct(def, id) {
		return {
				id: `prod-${id}`,
				slug: def.slug,
				name: def.name,
				model_code: def.model_code,
				category: "Коллекция 2025",
				short_description: def.short_description,
				description: def.description,
				max_temperature: 60,
				heater_type: "Сухой ТЭН",
				warranty_months: 24,
				variants: buildVariants(def),
				type: def.type,
		};
}

export const mockProducts = PRODUCT_DEFS.map((def, index) => buildProduct(def, index + 1));

export const mockProductsBySlug = Object.fromEntries(
		mockProducts.map((product) => [product.slug, product]),
);

export function getSimilarProducts(slug, limit = 3) {
		return mockProducts.filter((product) => product.slug !== slug).slice(0, limit);
}
