import {createContext, use} from "react";

export const ModalContext = createContext(null);

export function useModal() {
		const context = use(ModalContext);

		if (!context) {
				throw new Error("useModal must be used within ModalProvider");
		}

		return context;
}
