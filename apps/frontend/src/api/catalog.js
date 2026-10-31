import {apiFetch, fetchAllPages} from "./client";

export function getProducts(signal) {
		return fetchAllPages("/catalog/products", {signal});
}

export function getProduct(slug, signal) {
		return apiFetch(`/catalog/products/${encodeURIComponent(slug)}`, {signal});
}
