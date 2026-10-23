import {useId, useState} from "react";
import {Link, Navigate, useLocation, useNavigate} from "react-router";
import clsx from "clsx";
import {useAuth} from "../../../auth/auth-context";
import {ApiError} from "../../../api/client";
import {Input} from "../../../components/ui/input/input";
import {Button} from "../../../components/ui/button/button";
import {Text} from "../../../components/ui/typography/text/text";
import {Title} from "../../../components/ui/typography/title/title";
import s from "./login.module.css";
import a from "../admin.module.css";
import logo from "../../../assets/logo/logo.png";

export function AdminLogin() {
		const titleId = useId();
		const loginId = useId();
		const passwordId = useId();
		const navigate = useNavigate();
		const location = useLocation();
		const {login, isAuthenticated} = useAuth();

		const [form, setForm] = useState({login: "", password: ""});
		const [error, setError] = useState(null);
		const [pending, setPending] = useState(false);

		const requestedPath = location.state?.from?.pathname;
		const from = requestedPath?.startsWith("/admin") && requestedPath !== "/admin/login" ? requestedPath : "/admin";

		function update(field) {
				return (event) => {
						setForm((prev) => ({...prev, [field]: event.target.value}));
				};
		}

		async function handleSubmit(event) {
				event.preventDefault();
				setError(null);
				setPending(true);

				try {
						await login(form);
						navigate(from, {replace: true});
				} catch (err) {
						if (err instanceof ApiError && err.status === 401) {
								setError("Неверный логин или пароль");
						} else {
								setError(err?.message ?? "Не удалось войти, попробуйте ещё раз");
						}
				} finally {
						setPending(false);
				}
		}

		if (isAuthenticated) return <Navigate to={from} replace/>;

		return (
				<div className={clsx(s.screen, a.scope)}>
						<div className={s.card}>
								<div id={titleId} className={s.heading}>
										<img src={logo} width="48" height="48" alt="ErikNar"/>
										<Text as="span" variant="subtitle">Управление магазином</Text>
										<Title level={1}>Вход в админку</Title>
										<p className={a.muted}>Каталог, комплектации и заявки клиентов.</p>
								</div>

								<form className={s.form} onSubmit={handleSubmit} aria-labelledby={titleId}>
										<Input
												compact
												id={loginId}
												label="Логин"
												name="login"
												autoComplete="username"
												value={form.login}
												onChange={update("login")}
												required
												maxLength={120}
												disabled={pending}
										/>

										<Input
												compact
												id={passwordId}
												label="Пароль"
												name="password"
												type="password"
												autoComplete="current-password"
												value={form.password}
												onChange={update("password")}
												required
												maxLength={128}
												disabled={pending}
										/>

										{error && <p className={s.error} role="alert">{error}</p>}

										<Button
												type="submit"
												variant="ginger"
												size="compact"
												disabled={pending}
												className={s.submit}
												isLoading={pending}
										>
												Войти
										</Button>
								</form>
								<Link className={s.back} to="/">Вернуться на сайт</Link>
						</div>
				</div>
		);
}
