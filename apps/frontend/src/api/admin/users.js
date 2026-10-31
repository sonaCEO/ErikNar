import {apiFetch, fetchAllPages, toQueryString} from "../client";

const PAGE_SIZE = 20;

export function fetchEmployeePage(page = 1, signal) {
		return apiFetch(`/admin/users${toQueryString({page, page_size: PAGE_SIZE})}`, {signal});
}

export function fetchEmployees(signal) {
		return fetchAllPages("/admin/users", {signal});
}

export function fetchEmployee(id, signal) {
		return apiFetch(`/admin/users/${id}`, {signal});
}

export function createEmployee(body) {
		return apiFetch("/admin/users", {method: "POST", body});
}

export function updateEmployee(id, body) {
		return apiFetch(`/admin/users/${id}`, {method: "PATCH", body});
}
