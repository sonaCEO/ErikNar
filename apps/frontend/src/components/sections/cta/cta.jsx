import {phone} from "../../../data/site";
import LayoutContainer from "../../grid/layout-container/layout-container";
import {Button} from "../../ui/button/button";
import {Text} from "../../ui/typography/text/text";
import {TitleGroup} from "../../ui/title-group/title-group";
import {ctaData} from "./data";
import s from "./cta.module.css";

export function Cta() {
		return (
				<section className={s.cta} id="cta">
						<LayoutContainer>
								<div className={s.inner}>
										<TitleGroup
												align="center"
												subtitle={ctaData.eyebrow}
												title={ctaData.title}
												titleVariant="white"
												titleLevel={2}
												text={ctaData.text}
												textVariant="caption"
										/>

										<div className={s.actions}>
												<Text as="a" href={phone.href} variant="white">
														{phone.label}
												</Text>

												<Button variant="ginger" size="lg">
														{ctaData.button}
												</Button>
										</div>
								</div>
						</LayoutContainer>
				</section>
		);
}
