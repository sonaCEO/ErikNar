const TRANSLIT = {
		а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i",
		к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
		х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export const CONTROL_CHOICES = ["Кнопочное", "Электронное"];

export function slugify(value) {
		const transliterated = [...String(value).toLowerCase()].map((char) => TRANSLIT[char] ?? char).join("");
		return transliterated.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
}

export function buildOffer({modelCode, sizes, bodies, controls, priceMinor}) {
		const variants = [];
		for (const size of sizes) {
				for (const body of bodies) {
						const panelName = String(body.panelName ?? "").trim();
						for (const control of controls) {
								const sku = [
										"EN",
										slugify(modelCode),
										`${size.height}X${size.width}`,
										slugify(body.name),
										slugify(control),
										slugify(panelName),
								].join("-").toUpperCase().slice(0, 120);
								variants.push({
										colorKey: body.key,
										sku,
										width_mm: size.width,
										height_mm: size.height,
										body_color: {name: body.name.trim(), hex_value: body.hex},
										panel_color: {name: panelName},
										control_type: {name: control.trim()},
										price_minor: priceMinor,
										currency: "RUB",
										availability_status: "in_stock",
										is_active: true,
								});
						}
				}
		}
		return variants;
}

export function activeRows(rows) {
		const active = rows.filter((row) => row.is_active !== false);
		return active.length ? active : rows;
}

export function uniqueBy(items, key) {
		const result = [];
		for (const item of items) {
				const id = key(item);
				if (result.some((existing) => key(existing) === id)) continue;
				result.push(item);
		}
		return result;
}
