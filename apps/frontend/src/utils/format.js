export function formatPriceMinor(priceMinor, currency = "RUB") {
		const amount = Number(priceMinor) / 100;
		const formatted = amount.toLocaleString("ru-RU", {
				minimumFractionDigits: Number(priceMinor) % 100 ? 2 : 0,
				maximumFractionDigits: 2,
		});

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
