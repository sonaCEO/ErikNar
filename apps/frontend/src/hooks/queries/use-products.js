import {useQueries, useQuery, useQueryClient} from "@tanstack/react-query";
import {getProduct, getProducts} from "../../api/catalog";
import {queryKeys} from "./query-keys";

export function useProducts() {
		return useQuery({
				queryKey: queryKeys.products,
				queryFn: ({signal}) => getProducts(signal),
		});
}

export function useCatalogProducts() {
		const client = useQueryClient();
		const list = useProducts();
		const details = useQueries({
				queries: (list.data ?? []).map((product) => ({
						queryKey: queryKeys.product(product.slug),
						queryFn: ({signal}) => getProduct(product.slug, signal),
				})),
		});
		return {
				products: details.flatMap((query, index) => query.data ? [{
						...query.data,
						primary_image_url: list.data[index].primary_image_url
				}] : []),
				pendingCount: list.isPending ? 4 : details.filter((query) => query.isPending).length,
				isFetching: list.isFetching || details.some((query) => query.isFetching),
				error: list.error ?? details.find((query) => query.error)?.error,
				refetch: () => client.invalidateQueries({queryKey: queryKeys.products}),
		};
}

export function useProduct(slug) {
		return useQuery({
				queryKey: queryKeys.product(slug),
				queryFn: ({signal}) => getProduct(slug, signal),
				enabled: Boolean(slug),
		});
}
