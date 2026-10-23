export const AVAILABILITY_LABELS = {
		in_stock: "В наличии",
		made_to_order: "Под заказ",
		out_of_stock: "Нет в наличии",
		hidden: "Скрыт",
};

export const UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export const MAX_INTEGER = 2147483647;
export const MAX_ORDER_POSITION = MAX_INTEGER + 1;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function integer(value, label, min = 0, max = MAX_INTEGER) {
		const number = Number(value);
		if (String(value).trim() === "" || !Number.isSafeInteger(number) || number < min || number > max) {
				throw new Error(`${label}: укажите целое число от ${min} до ${max}.`);
		}
		return number;
}

export function orderToPosition(order) {
		return order + 1;
}

export function positionToOrder(position) {
		return integer(position, "Порядок", 1, MAX_ORDER_POSITION) - 1;
}

export function priceToMinor(value) {
		const text = String(value).trim().replace(",", ".");
		if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Укажите цену без знака минус, не более двух знаков после запятой.");
		const [whole, fraction = ""] = text.split(".");
		const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
		if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Цена слишком велика.");
		return Number(amount);
}

export function minorToPrice(value) {
		return `${Math.trunc(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

export function productDraft(product) {
		return {
				name: product?.name ?? "", slug: product?.slug ?? "", model_code: product?.model_code ?? "",
				category: product?.category ?? "", short_description: product?.short_description ?? "",
				description: product?.description ?? "", heater_type: product?.heater_type ?? "",
				max_temperature: product?.max_temperature ?? 60, warranty_months: product?.warranty_months ?? 24,
				sort_order: orderToPosition(product?.sort_order ?? 0), is_published: product?.is_published ?? false,
		};
}

export function productPayload(draft) {
		const body = {...draft};
		for (const field of ["name", "slug", "model_code", "category", "short_description", "description", "heater_type"]) {
				body[field] = String(body[field]).trim();
				if (!body[field]) throw new Error("Заполните все обязательные поля. Значение не может состоять из пробелов.");
		}
		body.max_temperature = integer(body.max_temperature, "Температура", 1);
		body.warranty_months = integer(body.warranty_months, "Гарантия");
		body.sort_order = positionToOrder(body.sort_order);
		return body;
}

export function validateImage(file) {
		if (!file || file.size === 0) throw new Error("Выберите непустой файл изображения.");
		if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Поддерживаются только JPG, PNG и WebP.");
		if (file.size > MAX_IMAGE_BYTES) throw new Error("Изображение не должно превышать 10 МиБ.");
}

export function sameMediaScope(a, b) {
		return a.product_id === b.product_id && a.variant_id === b.variant_id && a.body_color_id === b.body_color_id;
}
