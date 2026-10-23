import {Navigate, Outlet, useLocation} from "react-router";
import {useAuth} from "./auth-context";

export function RequireAuth({adminOnly = false}) {
		const {isAuthenticated, isLoading, user} = useAuth();
		const location = useLocation();

		if (isLoading) {
				return null;
		}

		if (!isAuthenticated) {
				return <Navigate to="/admin/login" state={{from: location}} replace/>;
		}

		if (adminOnly && user?.role !== "admin") return <Navigate to="/admin" replace/>;

		return <Outlet/>;
}
