import {Suspense} from "react";
import {NavLink, Outlet, useLocation, useNavigate} from "react-router";
import {ClipboardList, ExternalLink, LogOut, Package, UsersRound} from "lucide-react";
import clsx from "clsx";
import {useAuth} from "../../../auth/auth-context";
import {Button} from "../../../components/ui/button/button";
import {RequestState} from "../admin-ui";
import logo from "../../../assets/logo/logo.png";
import a from "../admin.module.css";
import s from "./admin-layout.module.css";

export function AdminLayout() {
		const {user, logout} = useAuth();
		const navigate = useNavigate();
		const location = useLocation();

		function handleLogout() {
				logout();
				navigate("/admin/login", {replace: true});
		}

		return (
				<div className={clsx(s.shell, a.scope)}>
						<aside className={s.sidebar}>
								<NavLink to="/admin" end className={s.brand}>
										<img src={logo} width="38" height="38" alt=""/>
										<span>ErikNar<small>Управление магазином</small></span>
								</NavLink>

								<nav className={s.nav} aria-label="Разделы админки">
										<NavLink
												to="/admin"
												end
												className={({isActive}) => clsx(s.link, (isActive || location.pathname.startsWith("/admin/leads/")) && s.active)}
										>
												<ClipboardList size={17}/> Заявки
										</NavLink>
										{user?.role === "admin" && <>
												<NavLink to="/admin/products" className={({isActive}) => clsx(s.link, isActive && s.active)}>
														<Package size={17}/> Товары
												</NavLink>
												<NavLink to="/admin/users" className={({isActive}) => clsx(s.link, isActive && s.active)}>
														<UsersRound size={17}/> Сотрудники
												</NavLink>
										</>}
								</nav>

								<div className={s.footer}>
										<a className={s.siteLink} href="/" target="_blank" rel="noreferrer"><ExternalLink
												size={15}/> Открыть сайт</a>
										<span className={s.userName}>{user?.name}</span>
										<span className={s.role}>{user?.role === "admin" ? "Администратор" : "Менеджер"}</span>
										<Button variant="soft" size="compact" onClick={handleLogout}>
												<LogOut size={15}/> Выйти
										</Button>
								</div>
						</aside>

						<main className={s.main}>
								<Suspense fallback={<RequestState pending/>}><Outlet/></Suspense>
						</main>
				</div>
		);
}
