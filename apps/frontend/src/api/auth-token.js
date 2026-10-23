export const TOKEN_KEY = "eriknar.admin_token";

export function getToken() {
		return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
		localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
		localStorage.removeItem(TOKEN_KEY);
}

export function subscribeToTokenChanges(listener) {
		function onStorage(event) {
				if (event.storageArea === localStorage && (event.key === TOKEN_KEY || event.key === null)) {
						listener(getToken());
				}
		}

		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
}
