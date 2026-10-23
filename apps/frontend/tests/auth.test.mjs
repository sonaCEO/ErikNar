import {test} from "node:test";
import assert from "node:assert/strict";
import {apiFetch, ApiError, UNAUTHORIZED_EVENT} from "../src/api/client.js";
import {clearToken, getToken, setToken, subscribeToTokenChanges, TOKEN_KEY} from "../src/api/auth-token.js";

function browser(t) {
		const values = new Map();
		const storage = {
				clear: () => values.clear(),
		};
		const window = new EventTarget();
		for (const [key, value] of [["localStorage", storage], ["window", window]]) {
				const original = Object.getOwnPropertyDescriptor(globalThis, key);
				Object.defineProperty(globalThis, key, {configurable: true, value});
				t.after(() => {
						if (original) Object.defineProperty(globalThis, key, original);
						else delete globalThis[key];
				});
		}
		return {storage, window};
}

function storageEvent(window, storageArea, key, newValue) {
		window.dispatchEvent(Object.assign(new Event("storage"), {storageArea, key, newValue}));
}

test("token subscription handles truthy replacements, logout and clear without trusting stale event values", (t) => {
		const {storage, window} = browser(t);
		setToken("old-login");
		const tokens = [];
		const unsubscribe = subscribeToTokenChanges((token) => tokens.push(token));
		setToken("new-login");
		storageEvent(window, storage, TOKEN_KEY, "new-login");
		assert.deepEqual(tokens, ["new-login"]);
		storageEvent(window, storage, "unrelated-key", "ignored");
		storageEvent(window, {}, TOKEN_KEY, "session-storage");
		assert.equal(tokens.length, 1);
		clearToken();
		storageEvent(window, storage, TOKEN_KEY, null);
		assert.deepEqual(tokens, ["new-login", null]);
		setToken("another-login");
		storage.clear();
		storageEvent(window, storage, null, null);
		assert.deepEqual(tokens, ["new-login", null, null]);
		setToken("latest-login");
		storageEvent(window, storage, null, null);
		assert.equal(tokens.at(-1), "latest-login");
		unsubscribe();
		clearToken();
		storageEvent(window, storage, TOKEN_KEY, null);
		assert.equal(tokens.length, 4);
});

for (const requestToken of ["old-login", null]) {
		test(`a late 401 from ${requestToken ?? "an anonymous request"} cannot erase a newer login`, async (t) => {
				const {window} = browser(t);
				if (requestToken) setToken(requestToken);
				const response = Promise.withResolvers();
				let unauthorized = 0;
				window.addEventListener(UNAUTHORIZED_EVENT, () => unauthorized++);
				t.mock.method(globalThis, "fetch", (_url, {headers}) => {
						assert.equal(headers.Authorization, requestToken ? `Bearer ${requestToken}` : undefined);
						return response.promise;
				});
				const pending = apiFetch("/auth/me");
				setToken("new-login");
				response.resolve(Response.json({error: {code: "unauthorized", message: "Expired"}}, {status: 401}));
				await assert.rejects(pending, (error) => error instanceof ApiError && error.status === 401);
				assert.equal(getToken(), "new-login");
				assert.equal(unauthorized, 0);
		});
}

test("a 401 for the currently stored token clears credentials and notifies this tab", async (t) => {
		const {window} = browser(t);
		setToken("expired-login");
		let unauthorized = 0;
		window.addEventListener(UNAUTHORIZED_EVENT, () => unauthorized++);
		t.mock.method(globalThis, "fetch", async () => Response.json({
				error: {
						code: "unauthorized",
						message: "Expired"
				}
		}, {status: 401}));
		await assert.rejects(apiFetch("/auth/me"), (error) => error instanceof ApiError && error.status === 401);
		assert.equal(getToken(), null);
		assert.equal(unauthorized, 1);
});
