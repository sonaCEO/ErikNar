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

export function selectVariant(variants, current, changes) {
		const candidates = variants.filter((variant) => (
				(changes.bodyColorId === undefined || variant.body_color.id === changes.bodyColorId)
				&& (changes.widthMm === undefined || variant.width_mm === changes.widthMm)
				&& (changes.heightMm === undefined || variant.height_mm === changes.heightMm)
				&& (changes.controlTypeId === undefined || variant.control_type.id === changes.controlTypeId)
				&& (changes.panelColorId === undefined || variant.panel_color.id === changes.panelColorId)
		));
		if (!candidates.length) return current ?? null;
		if (!current) return candidates[0];

		const score = (variant) => Number(variant.body_color.id === current.body_color.id) * 8
				+ Number(variant.width_mm === current.width_mm && variant.height_mm === current.height_mm) * 4
				+ Number(variant.control_type.id === current.control_type.id) * 2
				+ Number(variant.panel_color.id === current.panel_color.id);
		return candidates.reduce((best, variant) => score(variant) > score(best) ? variant : best);
}

export function sortMedia(media) {
		return [...media].sort((a, b) => {
				if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
				return a.sort_order - b.sort_order;
		});
}
