import {apiFetch} from "./client";

export function login({login, password}) {
		return apiFetch("/auth/login", {
				method: "POST",
				body: {login, password},
		});
}

export function fetchMe(signal) {
		return apiFetch("/auth/me", {signal});
}
