import {apiFetch, toQueryString} from "../client";

export function fetchLeads({page = 1, pageSize = 20, status, assignedToUserId, unassigned} = {}, signal) {
		const query = toQueryString({
				page,
				page_size: pageSize,
				status,
				assigned_to_user_id: assignedToUserId,
				unassigned,
		});
		return apiFetch(`/admin/leads${query}`, {signal});
}

export function fetchLead(leadId, signal) {
		return apiFetch(`/admin/leads/${leadId}`, {signal});
}

export function claimLead(leadId) {
		return apiFetch(`/admin/leads/${leadId}/claim`, {method: "POST"});
}

export function changeLeadStatus(leadId, {status, comment = "", expectedUpdatedAt}) {
		return apiFetch(`/admin/leads/${leadId}/status`, {
				method: "PATCH",
				body: {
						status,
						comment,
						expected_updated_at: expectedUpdatedAt,
				},
		});
}

export function assignLead(leadId, {userId, comment = "", expectedUpdatedAt}) {
		return apiFetch(`/admin/leads/${leadId}/assignee`, {
				method: "PATCH",
				body: {
						user_id: userId,
						comment,
						expected_updated_at: expectedUpdatedAt,
				},
		});
}
