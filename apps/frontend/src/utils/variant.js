export function uniqueBy(items, getKey) {
		const seen = new Set();
		const result = [];

		for (const item of items) {
				const key = getKey(item);
				if (seen.has(key)) continue;
				seen.add(key);
				result.push(item);
		}

		return result;
}

export function getBodyColors(variants) {
		return uniqueBy(
				variants.map((variant) => variant.body_color),
				(color) => color.id,
		);
}

export function getSizes(variants) {
		return uniqueBy(
				variants.map((variant) => ({
						width_mm: variant.width_mm,
						height_mm: variant.height_mm,
				})),
				(size) => `${size.width_mm}x${size.height_mm}`,
		);
}

export function getControlTypes(variants) {
		return uniqueBy(
				variants.map((variant) => variant.control_type),
				(control) => control.id,
		);
}

export function findVariant(variants, selection) {
		return variants.find((variant) => (
				variant.body_color.id === selection.bodyColorId
				&& variant.width_mm === selection.widthMm
				&& variant.height_mm === selection.heightMm
				&& variant.control_type.id === selection.controlTypeId
		)) ?? null;
}

export function sortMedia(media) {
		return [...media].sort((a, b) => {
				if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
				return a.sort_order - b.sort_order;
		});
}
