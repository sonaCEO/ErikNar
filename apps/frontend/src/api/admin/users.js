import {apiFetch} from "../client";

export function createEmployee(body) {
		return apiFetch("/admin/users", {method: "POST", body});
}

export function updateEmployee(id, body) {
		return apiFetch(`/admin/users/${id}`, {method: "PATCH", body});
}
