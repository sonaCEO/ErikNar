import {useCallback, useEffect, useRef, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {UNAUTHORIZED_EVENT} from "../api/client";
import {login as loginRequest, fetchMe} from "../api/auth";
import {clearToken, getToken, setToken, subscribeToTokenChanges} from "../api/auth-token";
import {queryKeys} from "../hooks/queries/query-keys";
import {clearSessionQueries} from "../hooks/queries/cache-policy";
import {AuthContext} from "./auth-context";

export function AuthProvider({children}) {
		const queryClient = useQueryClient();
		const [token, setSessionToken] = useState(getToken);
		const currentToken = useRef(token);

		const synchronizeSession = useCallback(
				async (nextToken, force = false) => {
						if (!force && currentToken.current === nextToken) {
								return queryClient.getQueryData(queryKeys.me) ?? null;
						}
						currentToken.current = nextToken;
						clearSessionQueries(queryClient);
						setSessionToken(nextToken);
						if (!nextToken) return null;

						return queryClient.ensureQueryData({
								queryKey: queryKeys.me,
								queryFn: ({signal}) => fetchMe(signal),
								staleTime: 0,
								retry: false,
						});
				},
				[queryClient]
		);

		const dropSession = useCallback(() => {
				clearToken();
				return synchronizeSession(null, true);
		}, [synchronizeSession]);

		useEffect(() => {
				const onTokenChange = (nextToken) => {
						void synchronizeSession(nextToken).catch(() => {
						});
				};
				const onUnauthorized = () => onTokenChange(getToken());
				const unsubscribe = subscribeToTokenChanges(onTokenChange);
				window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
				onUnauthorized();
				return () => {
						unsubscribe();
						window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
				};
		}, [synchronizeSession]);

		const meQuery = useQuery({
				queryKey: queryKeys.me,
				queryFn: ({signal}) => fetchMe(signal),
				enabled: Boolean(token),
				retry: false,
				staleTime: 5 * 60 * 1000,
		});

		const login = useCallback(
				async ({login, password}) => {
						const {access_token} = await loginRequest({login, password});
						setToken(access_token);
						return synchronizeSession(access_token, true);
				},
				[synchronizeSession]
		);

		const value = {
				user: token ? (meQuery.data ?? null) : null,
				isAuthenticated: Boolean(token && meQuery.data),
				isLoading: Boolean(token) && meQuery.isLoading,
				login,
				logout: dropSession,
		};

		return <AuthContext value={value}>{children}</AuthContext>;
}