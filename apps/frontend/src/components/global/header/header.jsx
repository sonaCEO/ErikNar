import {navigation} from "./data.js";
import LayoutContainer from "../../grid/layout-container/layout-container";
import Logo from "../../global/logo/logo";
import {Button} from "../../ui/button/button";
import s from "./header.module.css";

export default function Header() {
		return (
				<header className={s.header}>
						<LayoutContainer>
								<div className={s.wrapper}>
										<Logo/>

										<nav className={s.nav} aria-label="Основная навигация">
												<ul>
														{navigation.map((item) => (
																<li key={item.id}>
																		<a href={item.url}>{item.name}</a>
																</li>
														))}
												</ul>
										</nav>

										<div className={s.actions}>
												<Button variant="black" size="md">Оставить заявку</Button>
										</div>

										<Button variant="burger"><span/></Button>
								</div>
						</LayoutContainer>
				</header>
		);
}
