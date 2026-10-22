import {useState} from "react";
import clsx from "clsx";
import {Phone} from "lucide-react";
import {RemoveScroll} from "react-remove-scroll";
import {useHeaderScroll} from "../../../hooks/use-header-scroll";
import {navigation, phone} from "./data.js";
import LayoutContainer from "../../grid/layout-container/layout-container";
import Logo from "../../global/logo/logo";
import {Button} from "../../ui/button/button";
import s from "./header.module.css";

function NavLinks() {
		return navigation.map((item) => (
				<li key={item.id}>
						<a href={item.url}>{item.name}</a>
				</li>
		));
}

function Cta() {
		return <Button variant="black" size="md">Оставить заявку</Button>;
}

export default function Header() {
		const [menuOpen, setMenuOpen] = useState(false);
		const {active, hidden} = useHeaderScroll({paused: menuOpen});

		return (
				<header
						className={clsx(
								s.header,
								menuOpen ? s.open : active && s.active,
								!menuOpen && hidden && s.hidden,
						)}
				>
						<div className={s.overlay} onClick={() => setMenuOpen(false)}/>

						<RemoveScroll enabled={menuOpen} forwardProps>
								<div className={s.drawer}>
										<nav className={s.drawerNav} aria-label="Мобильная навигация">
												<ul>
														<NavLinks/>
												</ul>
										</nav>

										<div className={s.drawerActions}>
												<a className={s.phone} href={phone.href}>
														<span className={s.phoneCaption}>Позвонить</span>
														<span className={s.phoneValue}>
																<Phone aria-hidden="true"/>
																{phone.label}
														</span>
												</a>
												<Cta/>
										</div>
								</div>
						</RemoveScroll>

						<LayoutContainer>
								<div className={s.wrapper}>
										<Logo/>

										<nav className={s.nav} aria-label="Основная навигация">
												<ul>
														<NavLinks/>
												</ul>
										</nav>

										<div className={s.actions}>
												<Cta/>
										</div>

										<Button
												variant="burger"
												className={s.burger}
												aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
												aria-expanded={menuOpen}
												onClick={() => setMenuOpen((open) => !open)}
										>
												<span/>
										</Button>
								</div>
						</LayoutContainer>
				</header>
		);
}
