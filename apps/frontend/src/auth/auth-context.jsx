import {createContext, use} from "react";

export const AuthContext = createContext(null);

export function useAuth() {
		const context = use(AuthContext);

		if (!context) {
				throw new Error("useAuth must be used within AuthProvider");
		}

		return context;
}
