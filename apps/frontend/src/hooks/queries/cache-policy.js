import {catalogOptionQueryKeys, queryKeys} from "./query-keys.js";

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

export function catalogMutationOptions(client, {kind, product, optionType}) {
		return {
				onMutate: () => ({
						kind,
						productId: product?.id,
						slug: product?.slug,
						optionType,
						previousSlug: product?.id ? client.getQueryData(queryKeys.adminProduct(product.id))?.slug : undefined,
				}),
				onSuccess: (record, variables, target) => {
						if (!record) return;
						if (target.kind === "product") {
								client.setQueryData(queryKeys.adminProduct(record.id), record);
						} else if (target.kind === "variant") {
								const productId = target.productId ?? record.product_id ?? variables.product_id;
								client.setQueryData(queryKeys.adminVariants(productId), (current) => current && [
										...current.filter((item) => item.id !== record.id),
										record,
								]);
						} else if (target.kind === "option") {
								const queryKey = catalogOptionQueryKeys[target.optionType];
								if (!queryKey) return;
								client.setQueryData(queryKey, (current) => current && [
										...current.filter((item) => item.id !== record.id),
										record,
								].sort((a, b) => a.name.localeCompare(b.name, "ru")));
						}
				},
				onSettled: async (record, _error, variables, target) => {
						if (target.kind === "option") {
								const queryKey = catalogOptionQueryKeys[target.optionType];
								if (queryKey) await client.invalidateQueries({queryKey, exact: true});
								return;
						}
						const productId = target.kind === "product" ? (record?.id ?? target.productId) : (target.productId ?? record?.product_id ?? variables.product_id);
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
						} else if (target.kind === "variant" && productId) {
								refreshes.push(client.invalidateQueries({queryKey: queryKeys.adminVariants(productId), exact: true}));
						} else if (target.kind === "media" && productId) {
								refreshes.push(client.invalidateQueries({queryKey: queryKeys.adminMedia(productId), exact: true}));
						}
						await Promise.all(refreshes);
						if (productId) {
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
