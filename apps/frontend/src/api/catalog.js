import {apiFetch} from "./client";

export async function getProducts(signal) {
		const page = await apiFetch("/catalog/products", {signal});
		return page.items;
}

export function getProduct(slug, signal) {
		return apiFetch(`/catalog/products/${encodeURIComponent(slug)}`, {signal});
}
