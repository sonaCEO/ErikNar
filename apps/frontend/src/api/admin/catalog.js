import {apiFetch, toQueryString} from "../client";

const ROOT = "/admin/catalog";

export function fetchAdminProducts(page = 1, signal) {
		return apiFetch(`${ROOT}/products${toQueryString({page, page_size: 20})}`, {signal});
}

export function fetchAdminProduct(id, signal) {
		return apiFetch(`${ROOT}/products/${id}`, {signal});
}

export function createProduct(body) {
		return apiFetch(`${ROOT}/products`, {method: "POST", body});
}

export function updateProduct(id, body) {
		return apiFetch(`${ROOT}/products/${id}`, {method: "PATCH", body});
}

export function archiveProduct(id, updatedAt) {
		return apiFetch(`${ROOT}/products/${id}/archive`, {
				method: "POST",
				body: {expected_updated_at: updatedAt},
		});
}

export function createVariant(body) {
		return apiFetch(`${ROOT}/variants`, {method: "POST", body});
}

export function updateVariant(id, body) {
		return apiFetch(`${ROOT}/variants/${id}`, {method: "PATCH", body});
}

export function createCatalogOption(resource, body) {
		return apiFetch(`${ROOT}/${resource}`, {method: "POST", body});
}

export function fetchProductMedia(productId, signal) {
		return apiFetch(`${ROOT}/products/${productId}/media`, {signal});
}

export function uploadProductMedia(productId, body) {
		return apiFetch(`${ROOT}/products/${productId}/media`, {method: "POST", body});
}

export function updateProductMedia(id, body) {
		return apiFetch(`${ROOT}/media/${id}`, {method: "PATCH", body});
}

export function deleteProductMedia(id) {
		return apiFetch(`${ROOT}/media/${id}`, {method: "DELETE"});
}
