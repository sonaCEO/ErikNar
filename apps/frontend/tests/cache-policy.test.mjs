import {test} from "node:test";
import assert from "node:assert/strict";
import {MutationObserver, QueryClient, QueryObserver, skipToken} from "@tanstack/react-query";
import {catalogMutationOptions, clearSessionQueries, invalidateLeadLists} from "../src/hooks/queries/cache-policy.js";
import {queryKeys} from "../src/hooks/queries/query-keys.js";
import {productDraft} from "../src/pages/admin/products/product-form.js";

const product = {id: "product-a", slug: "original", name: "Original", updated_at: "2026-10-23T05:00:00.123456Z"};
const other = {id: "product-b", slug: "unrelated"};
const variant = {
		id: "variant-a",
		product_id: product.id,
		sku: "SKU-A",
		price_minor: 100,
		updated_at: "2026-10-23T04:00:00.654321Z"
};

function createClient(t) {
		const client = new QueryClient({
				defaultOptions: {
						queries: {retry: false, staleTime: Infinity, gcTime: Infinity},
						mutations: {retry: false, gcTime: Infinity},
				}
		});
		t.after(() => client.clear());
		return client;
}

function seedCatalog(client) {
		for (const [key, data] of [
				[queryKeys.products, [product, other]],
				[queryKeys.product(product.slug), product], [queryKeys.product(other.slug), other],
				[queryKeys.adminProducts(1), {items: [product]}], [queryKeys.adminProducts(2), {items: [other]}],
				[queryKeys.adminProduct(product.id), product], [queryKeys.adminProduct(other.id), other],
				[queryKeys.adminMedia(product.id), []], [queryKeys.adminMedia(other.id), []],
				[queryKeys.adminVariants(product.id), [variant]], [queryKeys.adminVariants(other.id), []],
				[queryKeys.adminOptions, []], [queryKeys.adminEmployees, []],
		]) client.setQueryData(key, data);
}

function assertInvalidated(client, keys) {
		const actual = client.getQueryCache().getAll().filter((query) => query.state.isInvalidated).map((query) => JSON.stringify(query.queryKey)).sort();
		assert.deepEqual(actual, keys.map((key) => JSON.stringify(key)).sort());
}

function mutation(client, target, mutationFn) {
		return new MutationObserver(client, {mutationFn, ...catalogMutationOptions(client, target)});
}

test("public lead creation invalidates all admin lead lists, not details or catalog", async (t) => {
		const client = createClient(t);
		const lists = [queryKeys.adminLeads({page: 1}), queryKeys.adminLeads({page: 2, status: "new"})];
		for (const key of [...lists, queryKeys.adminLead("lead-a"), queryKeys.products]) client.setQueryData(key, []);
		await invalidateLeadLists(client);
		assertInvalidated(client, lists);
});

test("product rename invalidates every admin list and only the affected product details", async (t) => {
		const client = createClient(t);
		seedCatalog(client);
		client.setQueryData(queryKeys.product("renamed"), {...product, slug: "renamed"});
		const result = {...product, slug: "renamed", updated_at: "2026-10-23T05:01:00.123457Z"};
		await mutation(client, {kind: "product", product}, async () => result).mutate({slug: result.slug});
		assert.deepEqual(client.getQueryData(queryKeys.adminProduct(product.id)), result);
		assertInvalidated(client, [queryKeys.adminProducts(1), queryKeys.adminProducts(2), queryKeys.adminProduct(product.id), queryKeys.products, queryKeys.product(product.slug), queryKeys.product(result.slug)]);
});

test("product response is cached before refetch and cannot overwrite the newer GET snapshot", async (t) => {
		const client = createClient(t);
		seedCatalog(client);
		const response = {...product, name: "Saved", updated_at: "2026-10-23T05:01:00.123457Z"};
		const latest = {...response, name: "Changed again", updated_at: "2026-10-23T05:01:00.123458Z"};
		const adminStarted = Promise.withResolvers();
		const adminResult = Promise.withResolvers();
		const detailStarted = Promise.withResolvers();
		const detailResult = Promise.withResolvers();
		const admin = new QueryObserver(client, {
				queryKey: queryKeys.adminProduct(product.id), queryFn: () => {
						assert.deepEqual(client.getQueryData(queryKeys.adminProduct(product.id)), response);
						adminStarted.resolve();
						return adminResult.promise;
				}
		});
		const detail = new QueryObserver(client, {
				queryKey: queryKeys.product(product.slug), queryFn: () => {
						detailStarted.resolve();
						return detailResult.promise;
				}
		});
		t.after(admin.subscribe(() => {
		}));
		t.after(detail.subscribe(() => {
		}));
		const save = mutation(client, {kind: "product", product}, async (body) => {
				assert.equal(body.expected_updated_at, product.updated_at);
				return response;
		});
		const pending = save.mutate({expected_updated_at: product.updated_at});
		await adminStarted.promise;
		assert.equal(save.getCurrentResult().isPending, true);
		adminResult.resolve(latest);
		await detailStarted.promise;
		assert.equal(save.getCurrentResult().isPending, true);
		detailResult.resolve(latest);
		assert.deepEqual(await pending, response);
		const snapshot = client.getQueryData(queryKeys.adminProduct(product.id));
		assert.deepEqual(snapshot, latest);
		assert.equal(productDraft(snapshot).name, "Changed again");
		assert.equal(snapshot.updated_at, "2026-10-23T05:01:00.123458Z");
});

test("product creation primes the admin detail cache for navigation", async (t) => {
		const client = createClient(t);
		const save = mutation(client, {kind: "product"}, async () => product);
		await save.mutate({slug: product.slug});
		assert.deepEqual(client.getQueryData(queryKeys.adminProduct(product.id)), product);
		assert.equal(client.getQueryData(queryKeys.adminProduct(undefined)), undefined);
});

test("product conflicts still refresh lists and discover the other editor's new slug", async (t) => {
		const client = createClient(t);
		seedCatalog(client);
		const latest = {...product, slug: "changed-elsewhere"};
		const admin = new QueryObserver(client, {
				queryKey: queryKeys.adminProduct(product.id),
				queryFn: async () => latest
		});
		t.after(admin.subscribe(() => {
		}));
		const invalidate = t.mock.method(client, "invalidateQueries");
		const conflict = Object.assign(new Error("Changed"), {code: "concurrent_update", status: 409});
		await assert.rejects(mutation(client, {kind: "product", product}, async () => {
				throw conflict;
		}).mutate({slug: "attempted"}), conflict);
		assert.deepEqual(client.getQueryData(queryKeys.adminProduct(product.id)), latest);
		for (const slug of [product.slug, "attempted", latest.slug]) {
				assert.ok(invalidate.mock.calls.some(({arguments: [filter]}) => filter.exact === true && JSON.stringify(filter.queryKey) === JSON.stringify(queryKeys.product(slug))));
		}
		assert.equal(client.getQueryState(queryKeys.adminProducts(2)).isInvalidated, true);
		assert.equal(client.getQueryState(queryKeys.product(other.slug)).isInvalidated, false);
});

test("variant mutation upserts the real session response and only refreshes public product data", async (t) => {
		const client = createClient(t);
		seedCatalog(client);
		const result = {...variant, price_minor: 200, updated_at: "2026-10-23T05:02:00.123456Z"};
		await mutation(client, {
				kind: "variant",
				product,
				variantId: variant.id
		}, async () => result).mutate({expected_updated_at: variant.updated_at});
		assert.deepEqual(client.getQueryData(queryKeys.adminVariants(product.id)), [result]);
		assertInvalidated(client, [queryKeys.products, queryKeys.product(product.slug)]);
});

test("variant conflict retains its row and original timestamp but remains read-only after remount", async (t) => {
		const client = createClient(t);
		seedCatalog(client);
		const conflict = Object.assign(new Error("Changed"), {code: "concurrent_update", status: 409});
		await assert.rejects(mutation(client, {kind: "variant", product, variantId: variant.id}, async () => {
				throw conflict;
		}).mutate({expected_updated_at: variant.updated_at}), conflict);
		const options = {
				queryKey: queryKeys.adminVariants(product.id),
				queryFn: skipToken,
				initialData: [],
				gcTime: Infinity
		};
		const mounted = new QueryObserver(client, options);
		const unsubscribe = mounted.subscribe(() => {
		});
		assert.deepEqual(mounted.getCurrentResult().data, [{...variant, readOnly: true}]);
		unsubscribe();
		const remounted = new QueryObserver(client, options);
		t.after(remounted.subscribe(() => {
		}));
		assert.deepEqual(remounted.getCurrentResult().data, [{...variant, readOnly: true}]);
		assertInvalidated(client, [queryKeys.products, queryKeys.product(product.slug)]);
});

for (const [name, error] of [
		["success", null],
		["conflict", Object.assign(new Error("Changed"), {code: "concurrent_update", status: 409})],
		["partial failure after primary demotion", new Error("Promotion and rollback failed")],
]) {
		test(`media ${name} refreshes only its media list and public product data`, async (t) => {
				const client = createClient(t);
				seedCatalog(client);
				const pending = mutation(client, {kind: "media", product}, async () => {
						if (error) throw error;
						return null;
				}).mutate("media-id");
				if (error) await assert.rejects(pending, error);
				else await pending;
				assertInvalidated(client, [queryKeys.adminMedia(product.id), queryKeys.products, queryKeys.product(product.slug)]);
		});
}

test("unused option creation only upserts session options with no invalidation", async (t) => {
		const client = createClient(t);
		seedCatalog(client);
		const invalidate = t.mock.method(client, "invalidateQueries");
		const result = {id: "color-a", name: "Graphite", slug: "graphite"};
		const save = mutation(client, {kind: "option", optionType: "body_color"}, async () => result);
		await save.mutate({name: result.name});
		await save.mutate({name: result.name});
		assert.deepEqual(client.getQueryData(queryKeys.adminOptions), [{type: "body_color", value: result}]);
		assert.equal(invalidate.mock.calls.length, 0);
		assertInvalidated(client, []);
});

test("session reset cancels old identity/admin requests, clears session data, and leaves public cache intact", async (t) => {
		const client = createClient(t);
		seedCatalog(client);
		client.setQueryData(queryKeys.me, {id: "old-user"});
		const requests = [queryKeys.me, queryKeys.adminProduct(product.id), queryKeys.products].map((key) => {
				const deferred = Promise.withResolvers();
				let signal;
				const pending = client.fetchQuery({
						queryKey: key, staleTime: 0, queryFn: (context) => {
								signal = context.signal;
								return deferred.promise;
						}
				}).catch((error) => error);
				return {key, signal, pending, resolve: deferred.resolve};
		});
		clearSessionQueries(client);
		assert.equal(requests[0].signal.aborted, true);
		assert.equal(requests[1].signal.aborted, true);
		assert.equal(requests[2].signal.aborted, false);
		assert.equal(client.getQueryData(queryKeys.me), undefined);
		assert.deepEqual(client.getQueriesData({queryKey: ["admin"]}), []);
		assert.deepEqual(client.getQueryData(queryKeys.product(product.slug)), product);
		const fresh = await client.fetchQuery({queryKey: queryKeys.me, queryFn: async () => ({id: "new-user"})});
		requests[0].resolve({id: "late-old-response"});
		requests[1].resolve({...product, name: "Late old response"});
		requests[2].resolve([product, other]);
		await Promise.all(requests.map((request) => request.pending));
		assert.deepEqual(client.getQueryData(queryKeys.me), fresh);
		assert.deepEqual(client.getQueriesData({queryKey: ["admin"]}), []);
});
