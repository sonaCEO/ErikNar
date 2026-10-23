import LayoutContainer from "../../grid/layout-container/layout-container";
import {useModal} from "../../modals/modal-context";
import {Button} from "../../ui/button/button";
import {TitleGroup} from "../../ui/title-group/title-group";
import {Text} from "../../ui/typography/text/text";
import {customMeta, customSteps} from "./data";
import s from "./custom.module.css";

export function Custom() {
		const {openModal} = useModal();

		return (
				<section className={s.custom} id="custom">
						<LayoutContainer>
								<div className={s.inner}>
										<figure className={s.visual}>
												<img
														className={s.image}
														src={customMeta.image.src}
														alt={customMeta.image.alt}
														width={customMeta.image.width}
														height={customMeta.image.height}
														loading="lazy"
														decoding="async"
												/>
										</figure>

										<div className={s.content}>
												<div className={s.heading}>
														<TitleGroup
																subtitle={customMeta.subtitle}
																title={customMeta.title}
																titleLevel={2}
																text={customMeta.text}
																textVariant="muted"
														/>
												</div>

												<ol className={s.steps}>
														{customSteps.map((step) => (
																<li key={step.id} className={s.step}>
																		<span className={s.stepNumber} aria-hidden="true">
																				{step.number}
																		</span>
																		<Text as="span" variant="base" className={s.stepText}>
																				{step.text}
																		</Text>
																</li>
														))}
												</ol>

												<Button
														variant="ginger"
														size="lg"
														onClick={() => openModal("consultation")}
												>
														{customMeta.button}
												</Button>
										</div>
								</div>
						</LayoutContainer>
				</section>
		);
}
