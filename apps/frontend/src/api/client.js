import {clearToken, getToken} from "./auth-token.js";

const API_BASE = "/api/v1";
export const UNAUTHORIZED_EVENT = "eriknar:unauthorized";

export class ApiError extends Error {
		constructor(code, message, {status, details} = {}) {
				super(message);
				this.name = "ApiError";
				this.code = code;
				this.status = status;
				this.details = details;
		}
}

async function parseErrorBody(response) {
		try {
				const body = await response.json();
				if (body && body.error) {
						return {
								code: body.error.code ?? "unknown_error",
								message: body.error.message ?? "Неизвестная ошибка",
								details: body.error.details ?? {},
						};
				}
		} catch {
				// A proxy or unavailable upstream may return an HTML error page.
		}
		return {
				code: "unknown_error",
				message: `Ошибка запроса (${response.status})`,
				details: {},
		};
}

export async function apiFetch(path, {
		method = "GET",
		body,
		idempotencyKey,
		signal,
} = {}) {
		const headers = {};
		const isFormData = body instanceof FormData;
		if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

		const token = getToken();
		if (token) headers["Authorization"] = `Bearer ${token}`;
		if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

		let response;
		try {
				response = await fetch(`${API_BASE}${path}`, {
						method,
						headers,
						body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
						signal,
				});
		} catch (error) {
				if (error.name === "AbortError") throw error;
				throw new ApiError("network_error", "Нет соединения с сервером", {status: 0});
		}

		if (!response.ok) {
				if (response.status === 401 && token && token === getToken()) {
						clearToken();
						window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
				}
				const error = await parseErrorBody(response);
				throw new ApiError(error.code, error.message, {
						status: response.status,
						details: error.details,
				});
		}

		if (response.status === 204) return null;
		return response.json();
}

export function toQueryString(params) {
		const search = new URLSearchParams();
		for (const [key, value] of Object.entries(params)) {
				if (value === undefined || value === null || value === "" || value === false) continue;
				search.set(key, value === true ? "true" : String(value));
		}
		const query = search.toString();
		return query ? `?${query}` : "";
}
