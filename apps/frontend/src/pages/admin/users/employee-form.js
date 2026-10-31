export function employeeDraft(mode) {
		return {
				name: "",
				login: "",
				password: "",
				role: mode === "create" ? "manager" : "",
				is_active: "",
				telegram_action: mode === "create" ? "set" : "keep",
				telegram_user_id: "",
		};
}

export function employeePayload(draft, mode) {
		const body = {};
		if (mode === "create" || draft.name.trim()) body.name = draft.name.trim();
		if (mode === "create") body.login = draft.login.trim();
		if (mode === "create" || draft.password) {
				if (draft.password.length < 12 || draft.password.length > 128) {
						throw new Error("Пароль должен содержать от 12 до 128 символов.");
				}
				body.password = draft.password;
		}
		if (draft.role) body.role = draft.role;
		if (mode === "create" && (!body.name || !body.login)) throw new Error("Заполните имя и логин сотрудника.");
		if (mode === "edit" && draft.is_active !== "") body.is_active = draft.is_active === "true";
		if (draft.telegram_action === "clear") body.telegram_user_id = null;
		else if (draft.telegram_action === "set") {
				const value = draft.telegram_user_id.trim();
				if (value) {
						if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
								throw new Error("Telegram ID должен быть целым числом в безопасном диапазоне.");
						}
						body.telegram_user_id = Number(value);
				} else if (mode === "edit") {
						throw new Error("Укажите Telegram ID или выберите действие «Отвязать».");
				}
		}
		if (!Object.keys(body).length) throw new Error("Укажите хотя бы одно изменение.");
		return body;
}
