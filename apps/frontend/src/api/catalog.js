import {apiFetch} from "./client";

export function getProducts(signal) {
		return apiFetch("/catalog/products", {signal});
}

export function getProduct(slug, signal) {
		return apiFetch(`/catalog/products/${encodeURIComponent(slug)}`, {signal});
}
