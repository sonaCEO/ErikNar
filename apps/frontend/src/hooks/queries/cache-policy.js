import {queryKeys} from "./query-keys.js";

export function clearSessionQueries(client) {
		for (const queryKey of [queryKeys.me, ["admin"]]) {
				void client.cancelQueries({queryKey});
				client.removeQueries({queryKey});
		}
}

export function invalidateLeadLists(client) {
		return client.invalidateQueries({
				queryKey: ["admin", "leads"],
				predicate: ({queryKey}) => queryKey.length === 3,
		});
}

export function catalogMutationOptions(client, {kind, product, variantId, optionType}) {
		return {
				onMutate: () => ({
						kind, productId: product?.id, slug: product?.slug, variantId, optionType,
						previousSlug: product?.id ? client.getQueryData(queryKeys.adminProduct(product.id))?.slug : undefined,
				}),
				onSuccess: (record, variables, target) => {
						if (!record) return;
						if (target.kind === "product") {
								client.setQueryData(queryKeys.adminProduct(record.id), record);
						} else if (target.kind === "variant") {
								client.setQueryData(queryKeys.adminVariants(target.productId ?? record.product_id ?? variables.product_id), (current = []) =>
										[...current.filter((item) => item.id !== record.id), record]);
						} else if (target.kind === "option") {
								client.setQueryData(queryKeys.adminOptions, (current = []) => [
										...current.filter((item) => item.type !== target.optionType || item.value.id !== record.id),
										{type: target.optionType, value: record},
								]);
						}
				},
				onSettled: async (record, error, variables, target) => {
						if (target.kind === "option") return;
						const productId = target.kind === "product" ? (record?.id ?? target.productId) : (target.productId ?? record?.product_id ?? variables.product_id);
						if (target.kind === "variant" && error?.code === "concurrent_update") {
								// There is no variant GET to recover a valid concurrency token.
								client.setQueryData(queryKeys.adminVariants(productId), (current) => current?.map((item) =>
										item.id === target.variantId ? {...item, readOnly: true} : item));
						}
						const slugs = new Set([target.slug, target.previousSlug]);
						if (target.kind === "product") {
								slugs.add(record?.slug);
								slugs.add(variables.slug);
						}
						const refreshes = [client.invalidateQueries({queryKey: queryKeys.products, exact: true})];
						if (target.kind === "product") {
								refreshes.push(client.invalidateQueries({queryKey: ["admin", "catalog", "products"]}));
								if (productId) refreshes.push(client.invalidateQueries({
										queryKey: queryKeys.adminProduct(productId),
										exact: true
								}));
						} else if (target.kind === "media" && productId) {
								refreshes.push(client.invalidateQueries({queryKey: queryKeys.adminMedia(productId), exact: true}));
						}
						await Promise.all(refreshes);
						if (productId) {
								// A refetch after a conflict can reveal a slug changed by another editor.
								slugs.add(client.getQueryData(queryKeys.adminProduct(productId))?.slug);
								slugs.add(client.getQueryData(queryKeys.products)?.find((item) => item.id === productId)?.slug);
								for (const [key, detail] of client.getQueriesData({queryKey: queryKeys.products})) {
										if (key.length === 3 && detail?.id === productId) slugs.add(key[2]);
								}
						}
						await Promise.all([...slugs].filter(Boolean).map((slug) =>
								client.invalidateQueries({queryKey: queryKeys.product(slug), exact: true})));
				},
		};
}
