import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {fetchLead, fetchLeads} from "../../api/admin/leads";
import {queryKeys} from "./query-keys";

export function useAdminLeads(filters) {
		return useQuery({
				queryKey: queryKeys.adminLeads(filters),
				queryFn: ({signal}) => fetchLeads(filters, signal),
				placeholderData: keepPreviousData,
		});
}

export function useAdminLead(leadId) {
		return useQuery({
				queryKey: queryKeys.adminLead(leadId),
				queryFn: ({signal}) => fetchLead(leadId, signal),
				enabled: Boolean(leadId),
		});
}
