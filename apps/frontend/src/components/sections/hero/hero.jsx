import LayoutContainer from "../../grid/layout-container/layout-container";
import {useModal} from "../../modals/modal-context";
import {TitleGroup} from "../../ui/title-group/title-group";
import {Button} from "../../ui/button/button";
import {Fact} from "../../ui/fact/fact";
import {heroData} from "./data";
import s from "./hero.module.css";

export function Hero() {
		const {openModal} = useModal();

		function openConsultation() {
				openModal("consultation");
		}

		return (
				<section className={s.hero}>
						<div className={s.stage}>
								<LayoutContainer>
										<div className={s.stageInner}>
												<div className={s.copy}>
														<TitleGroup
															subtitle={heroData.subtitle}
															title={heroData.title}
															titleLevel={1}
															text={heroData.text}
															textVariant="muted"
														/>

														<div className={s.actions}>
																<Button
																		variant="soft"
																		size="lg"
																		onClick={() => {
																				document.getElementById("collection")?.scrollIntoView({
																						behavior: "smooth",
																				});
																		}}
																>
																		Смотреть каталог
																</Button>
																<Button variant="black" size="lg" onClick={openConsultation}>
																		Получить консультацию
																</Button>
														</div>
												</div>
										</div>
								</LayoutContainer>

								<figure className={s.visual}>
										<img
											className={s.image}
											src={heroData.image.src}
											alt={heroData.image.alt}
											width={heroData.image.width}
											height={heroData.image.height}
											decoding="async"
											fetchPriority="high"
										/>
								</figure>
						</div>

						<div className={s.bar}>
								<LayoutContainer>
										<div className={s.barInner}>
												<div className={s.barLead}>
														<p className={s.barTitle}>{heroData.barTitle}</p>
														<Button
																variant="ginger"
																size="sm"
																onClick={() => openModal("details", {
																		subtitle: "Преимущества",
																		title: "Тепло, которому можно доверять",
																		paragraphs: [
																				"Мягкий нагрев без перегрева — комфортно в ванной каждый день.",
																				"Матовые покрытия от спокойного крема до глубокого графита.",
																				"Долгий срок службы и гарантия 2 года на каждое изделие.",
																		],
																		facts: heroData.facts,
																})}
														>
																Подробнее
														</Button>
												</div>

												<div className={s.barFacts}>
														{heroData.facts.map((fact) => (
																<Fact
																	key={fact.label}
																	value={fact.value}
																	unit={fact.unit}
																	label={fact.label}
																	variant="inverse"
																/>
														))}
												</div>
										</div>
								</LayoutContainer>
						</div>
				</section>
		);
}
