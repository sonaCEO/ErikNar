export function formatPriceMinor(priceMinor, currency = "RUB") {
		const amount = Math.round(Number(priceMinor) / 100);
		const formatted = amount.toLocaleString("ru-RU");

		if (currency === "RUB") return `${formatted} ₽`;
		return `${formatted} ${currency}`;
}

export function formatSizeMm(widthMm, heightMm) {
		return `${heightMm} × ${widthMm}`;
}

export function formatWarrantyMonths(months) {
		const years = months / 12;
		if (Number.isInteger(years) && years > 0) {
				const word = years === 1 ? "год" : years < 5 ? "года" : "лет";
				return `Гарантия ${years} ${word}`;
		}

		return `Гарантия ${months} мес.`;
}
