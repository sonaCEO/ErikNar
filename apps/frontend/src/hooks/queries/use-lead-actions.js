import {useMutation, useQueryClient} from "@tanstack/react-query";
import {assignLead, changeLeadStatus, claimLead} from "../../api/admin/leads";

function useInvalidateLeads() {
		const queryClient = useQueryClient();
		return () => queryClient.invalidateQueries({queryKey: ["admin", "leads"]});
}

export function useClaimLead(leadId) {
		const invalidate = useInvalidateLeads();
		return useMutation({
				mutationFn: () => claimLead(leadId),
				onSettled: invalidate,
		});
}

export function useChangeLeadStatus(leadId) {
		const invalidate = useInvalidateLeads();
		return useMutation({
				mutationFn: ({status, comment, expectedUpdatedAt}) =>
						changeLeadStatus(leadId, {status, comment, expectedUpdatedAt}),
				onSettled: invalidate,
		});
}

export function useAssignLead(leadId) {
		const invalidate = useInvalidateLeads();
		return useMutation({
				mutationFn: ({userId, comment, expectedUpdatedAt}) =>
						assignLead(leadId, {userId, comment, expectedUpdatedAt}),
				onSettled: invalidate,
		});
}
