import {footerCopy, navigation} from "../../../data/site";
import LayoutContainer from "../../grid/layout-container/layout-container";
import {Text} from "../../ui/typography/text/text";
import Logo from "../logo/logo";
import s from "./footer.module.css";

export default function Footer() {
		const year = new Date().getFullYear();

		return (
				<footer className={s.footer}>
						<LayoutContainer>
								<div className={s.inner}>
										<nav className={s.nav} aria-label="Навигация в подвале">
												<ul>
														{navigation.map((item) => (
																<li key={item.id}>
																		<a href={item.url}>{item.name}</a>
																</li>
														))}
												</ul>
										</nav>

										<div className={s.brand}>
												<Logo withDescription={false}/>
												<Text as="p" variant="muted" className={s.lead}>
														{footerCopy.text}
												</Text>
										</div>

										<Text as="p" variant="muted">
												© {year} {footerCopy.copyright}
										</Text>
								</div>
						</LayoutContainer>
				</footer>
		);
}
