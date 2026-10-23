import {keepPreviousData, skipToken, useMutation, useQueries, useQuery, useQueryClient} from "@tanstack/react-query";
import {fetchAdminProduct, fetchAdminProducts, fetchProductMedia} from "../../api/admin/catalog";
import {getProduct, getProducts} from "../../api/catalog";
import {queryKeys} from "./query-keys";
import {catalogMutationOptions} from "./cache-policy";

export function useAdminProducts(page) {
		return useQuery({
				queryKey: queryKeys.adminProducts(page),
				queryFn: ({signal}) => fetchAdminProducts(page, signal),
				placeholderData: keepPreviousData,
		});
}

export function useAdminProduct(id) {
		return useQuery({
				queryKey: queryKeys.adminProduct(id),
				queryFn: id ? ({signal}) => fetchAdminProduct(id, signal) : skipToken,
		});
}

export function useProductMedia(id) {
		return useQuery({
				queryKey: queryKeys.adminMedia(id),
				queryFn: ({signal}) => fetchProductMedia(id, signal),
		});
}

export function useCatalogMutation(mutationFn, target) {
		const client = useQueryClient();
		return useMutation({
				mutationFn,
				...catalogMutationOptions(client, target),
		});
}

// The API has no administrative read endpoints for options or variants.
// Keep actual mutation responses for this login, not a pretend server-side list.
export function useSessionRecords(queryKey) {
		return useQuery({queryKey, queryFn: skipToken, initialData: [], gcTime: Infinity}).data;
}

export function useCatalogOptions() {
		const created = useSessionRecords(queryKeys.adminOptions);
		const products = useQuery({queryKey: queryKeys.products, queryFn: ({signal}) => getProducts(signal)});
		const details = useQueries({
				queries: (products.data ?? []).map((product) => ({
						queryKey: queryKeys.product(product.slug),
						queryFn: ({signal}) => getProduct(product.slug, signal),
				})),
		});
		const options = {body_color: [], panel_color: [], control_type: []};
		for (const type of Object.keys(options)) {
				const values = details.flatMap((detail) => (detail.data?.variants ?? []).map((variant) => variant[type]));
				values.push(...created.filter((entry) => entry.type === type).map((entry) => entry.value));
				options[type] = [...new Map(values.map((value) => [value.id, value])).values()]
						.sort((a, b) => a.name.localeCompare(b.name, "ru"));
		}
		return {
				options,
				isPending: products.isPending || details.some((detail) => detail.isPending),
				error: products.error ?? details.find((detail) => detail.error)?.error,
		};
}
