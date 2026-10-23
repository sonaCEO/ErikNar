import {useMutation, useQueryClient} from "@tanstack/react-query";
import {createLead} from "../../api/leads";
import {invalidateLeadLists} from "./cache-policy";

export function useCreateLead() {
		const client = useQueryClient();
		return useMutation({
				retry: false,
				mutationFn: (payload) => createLead(payload, crypto.randomUUID()),
				onSuccess: () => invalidateLeadLists(client),
		});
}
