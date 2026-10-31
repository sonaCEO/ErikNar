import {keepPreviousData, skipToken, useQuery} from "@tanstack/react-query";
import {fetchEmployee, fetchEmployeePage, fetchEmployees} from "../../api/admin/users";
import {queryKeys} from "./query-keys";

export function useEmployeePage(page) {
		return useQuery({
				queryKey: queryKeys.adminUsers(page),
				queryFn: ({signal}) => fetchEmployeePage(page, signal),
				placeholderData: keepPreviousData,
		});
}

export function useEmployees({enabled = true} = {}) {
		return useQuery({
				queryKey: queryKeys.adminUsersAll,
				queryFn: ({signal}) => fetchEmployees(signal),
				enabled,
		});
}

export function useEmployee(id) {
		return useQuery({
				queryKey: queryKeys.adminUser(id),
				queryFn: id ? ({signal}) => fetchEmployee(id, signal) : skipToken,
		});
}
