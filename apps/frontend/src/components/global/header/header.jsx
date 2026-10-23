import {useState} from "react";
import clsx from "clsx";
import {Phone} from "lucide-react";
import {RemoveScroll} from "react-remove-scroll";
import {useHeaderScroll} from "../../../hooks/use-header-scroll";
import {useActiveSection} from "../../../hooks/use-active-section";
import {navigation, phone} from "../../../data/site";
import {useModal} from "../../modals/modal-context";
import LayoutContainer from "../../grid/layout-container/layout-container";
import Logo from "../logo/logo";
import {Button} from "../../ui/button/button";
import s from "./header.module.css";

const sectionIds = navigation.map((item) => item.id);

function NavLinks({activeId, onNavigate, linkClassName}) {
		return navigation.map((item) => {
				const isActive = activeId === item.id;

				return (
						<li key={item.id}>
								<a
										href={item.url}
										className={clsx(linkClassName, isActive && s.linkActive)}
										aria-current={isActive ? "location" : undefined}
										onClick={onNavigate}
								>
										{item.name}
								</a>
						</li>
				);
		});
}

function Cta({onClick}) {
		return (
				<Button variant="black" size="md" onClick={onClick}>
						Оставить заявку
				</Button>
		);
}

export default function Header() {
		const [menuOpen, setMenuOpen] = useState(false);
		const {active, hidden} = useHeaderScroll({paused: menuOpen});
		const activeSectionId = useActiveSection(sectionIds);
		const {openModal} = useModal();

		function openConsultation() {
				setMenuOpen(false);
				openModal("consultation");
		}

		function closeMenu() {
				setMenuOpen(false);
		}

		return (
				<header
						className={clsx(
								s.header,
								menuOpen ? s.open : active && s.active,
								!menuOpen && hidden && s.hidden,
						)}
				>
						<div className={s.overlay} onClick={closeMenu}/>

						<RemoveScroll enabled={menuOpen} forwardProps>
								<div className={s.drawer}>
										<nav className={s.drawerNav} aria-label="Мобильная навигация">
												<ul>
														<NavLinks
																activeId={activeSectionId}
																onNavigate={closeMenu}
																linkClassName={s.link}
														/>
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
												<Cta onClick={openConsultation}/>
										</div>
								</div>
						</RemoveScroll>

						<LayoutContainer>
								<div className={s.wrapper}>
										<Logo/>

										<nav className={s.nav} aria-label="Основная навигация">
												<ul>
														<NavLinks
																activeId={activeSectionId}
																linkClassName={s.link}
														/>
												</ul>
										</nav>

										<div className={s.actions}>
												<Cta onClick={openConsultation}/>
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
