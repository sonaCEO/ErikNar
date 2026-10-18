import {useNavigate} from "react-router";
import LayoutContainer from "../../grid/layout-container/layout-container";
import {TitleGroup} from "../title-group/title-group";
import {Button} from "../button/button";
import s from "./status-screen.module.css";

export function StatusScreen({code, subtitle, title, text, showReload = false}) {
		const navigate = useNavigate();

		return (
				<section className={s.screen}>
						<LayoutContainer>
								<div className={s.center}>
										{code && <p className={s.code}>{code}</p>}

										<TitleGroup
											subtitle={subtitle}
											title={title}
											titleLevel={2}
											text={text}
											textVariant="muted"
											align="center"
										/>

										<div className={s.actions}>
												<Button variant="black" size="lg" onClick={() => navigate("/")}>
														На главную
												</Button>
												{showReload && (
														<Button variant="underline" size="lg" onClick={() => window.location.reload()}>
																Обновить страницу
														</Button>
												)}
										</div>
								</div>
						</LayoutContainer>
				</section>
		);
}
