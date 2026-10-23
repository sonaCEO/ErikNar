export function formatPhoneRu(value) {
		const digits = String(value).replace(/\D/g, "");

		let normalized = digits;

		if (normalized.startsWith("8")) {
				normalized = `7${normalized.slice(1)}`;
		}

		if (!normalized.startsWith("7")) {
				normalized = `7${normalized}`;
		}

		normalized = normalized.slice(0, 11);

		const rest = normalized.slice(1);
		let result = "+7";

		if (rest.length === 0) {
				return digits.length > 0 ? result : "";
		}

		result += ` ${rest.slice(0, 3)}`;

		if (rest.length > 3) {
				result += ` ${rest.slice(3, 6)}`;
		}

		if (rest.length > 6) {
				result += `-${rest.slice(6, 8)}`;
		}

		if (rest.length > 8) {
				result += `-${rest.slice(8, 10)}`;
		}

		return result;
}

export function isPhoneRuComplete(value) {
		return String(value).replace(/\D/g, "").length === 11;
}
