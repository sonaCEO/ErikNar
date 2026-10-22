import LayoutContainer from "../../grid/layout-container/layout-container";
import {TitleGroup} from "../../ui/title-group/title-group";
import {Text} from "../../ui/typography/text/text";
import {advantages, advantagesMeta} from "./data";
import s from "./advantages.module.css";

export function Advantages() {
		return (
				<section className={s.advantages} id="advantages">
						<LayoutContainer>
								<div className={s.inner}>
										<TitleGroup
												subtitle={advantagesMeta.subtitle}
												title={advantagesMeta.title}
												titleLevel={2}
										/>

										<ul className={s.list}>
												{advantages.map(({id, title, Icon}) => (
														<li key={id} className={s.item}>
																<span className={s.icon} aria-hidden="true">
																		<Icon size={32} strokeWidth={1.5}/>
																</span>
																<Text as="p" variant="strong" className={s.itemTitle}>
																		{title}
																</Text>
														</li>
												))}
										</ul>
								</div>
						</LayoutContainer>
				</section>
		);
}
