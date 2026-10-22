import {formatPriceMinor} from "../../../utils/format";
import {mockProducts} from "../../../catalog/mock-products";

export const PAGE_SIZE = 10;

export const collectionMeta = {
		subtitle: "Коллекция",
		title: <>Выберите свою <strong>форму</strong> тепла</>,
		text: "Каждая модель комплектуется крючками, креплениями и выбранной панелью управления.",
};

export const collectionTabs = [
		{id: "all", label: "Все модели"},
		{id: "group", label: "Групповой"},
		{id: "ladder", label: "Лесенка"},
		{id: "vertical", label: "Вертикальная"},
];

export const collectionProducts = mockProducts.map((product) => {
		const primary = product.variants[0];
		const media = [...primary.media].sort((a, b) => {
				if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
				return a.sort_order - b.sort_order;
		})[0];

		const colors = [...new Map(
				product.variants.map((variant) => [variant.body_color.id, {
						id: variant.body_color.id,
						name: variant.body_color.name,
						hex: variant.body_color.hex_value,
				}]),
		).values()];

		const sizes = [...new Set(
				product.variants.map((variant) => `${variant.height_mm} × ${variant.width_mm}`),
		)];

		return {
				id: product.id,
				slug: product.slug,
				type: product.type,
				name: product.name,
				priceFrom: formatPriceMinor(primary.price_minor, primary.currency),
				description: product.short_description,
				colors,
				sizes,
				availabilityStatus: primary.availability_status,
				image: media
						? {src: media.url, alt: media.alt_text, width: 1024, height: 1024}
						: null,
				product,
		};
});
