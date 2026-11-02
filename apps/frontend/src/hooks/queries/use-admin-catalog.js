import {useMemo} from "react";
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
				queryFn: id ? ({signal}) => fetchProductMedia(id, signal) : skipToken,
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
		const bodyColors = queries[0]?.data;
		const panelColors = queries[1]?.data;
		const controlTypes = queries[2]?.data;
		const options = useMemo(() => ({
				body_color: [...(bodyColors ?? [])].sort(byName),
				panel_color: [...(panelColors ?? [])].sort(byName),
				control_type: [...(controlTypes ?? [])].sort(byName),
		}), [bodyColors, panelColors, controlTypes]);
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
