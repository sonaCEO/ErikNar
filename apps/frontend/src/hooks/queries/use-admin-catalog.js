import {keepPreviousData, skipToken, useMutation, useQueries, useQuery, useQueryClient} from "@tanstack/react-query";
import {
		fetchAdminProduct,
		fetchAdminProducts,
		fetchBodyColors,
		fetchControlTypes,
		fetchPanelColors,
		fetchProductMedia,
		fetchVariants,
} from "../../api/admin/catalog";
import {catalogOptionQueryKeys, queryKeys} from "./query-keys";
import {catalogMutationOptions} from "./cache-policy";

const catalogOptionQueries = [
		{type: "body_color", queryKey: catalogOptionQueryKeys.body_color, queryFn: fetchBodyColors},
		{type: "panel_color", queryKey: catalogOptionQueryKeys.panel_color, queryFn: fetchPanelColors},
		{type: "control_type", queryKey: catalogOptionQueryKeys.control_type, queryFn: fetchControlTypes},
];

function byName(a, b) {
		return a.name.localeCompare(b.name, "ru");
}

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

export function useAdminVariants(productId) {
		return useQuery({
				queryKey: queryKeys.adminVariants(productId),
				queryFn: productId ? ({signal}) => fetchVariants(productId, signal) : skipToken,
		});
}

export function useCatalogOptions() {
		const queries = useQueries({
				queries: catalogOptionQueries.map((item) => ({
						queryKey: item.queryKey,
						queryFn: ({signal}) => item.queryFn(signal),
				})),
		});
		const options = {body_color: [], panel_color: [], control_type: []};
		catalogOptionQueries.forEach((item, index) => {
				options[item.type] = [...(queries[index].data ?? [])].sort(byName);
		});
		return {
				options,
				isPending: queries.some((query) => query.isPending),
				error: queries.find((query) => query.error)?.error,
		};
}

export function useCatalogMutation(mutationFn, target) {
		const client = useQueryClient();
		return useMutation({
				mutationFn,
				...catalogMutationOptions(client, target),
		});
}
