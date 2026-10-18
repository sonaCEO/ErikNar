import LayoutContainer from "../../grid/layout-container/layout-container";
import {TitleGroup} from "../../ui/title-group/title-group";
import {Button} from "../../ui/button/button";
import {Fact} from "../../ui/fact/fact";
import {DotGrid} from "../../ui/dot-grid/dot-grid";
import {heroData} from "./data";
import heroImage from "../../../assets/hero-img.jpg";
import s from "./hero.module.css";

export function Hero() {
		return (
				<section className={s.hero}>

						<LayoutContainer>
								<div className={s.row}>
										<div className={s.copy}>

												<TitleGroup
													subtitle={heroData.subtitle}
													title={heroData.title}
													titleLevel={1}
													text={heroData.text}
													textVariant="muted"
												/>

												<div className={s.actions}>
														<Button variant="black" size="lg">Смотреть каталог</Button>
														<Button variant="underline">Получить консультацию</Button>
												</div>

												<div className={s.facts}>
														{heroData.facts.map((fact) => (
																<Fact
																	key={fact.label}
																	value={fact.value}
																	unit={fact.unit}
																	label={fact.label}
																/>
														))}
												</div>
										</div>

										<div className={s.visual}>
												<DotGrid className={s.dotsTop} cols={5} rows={5} size={8} gap={12} />
												<DotGrid className={s.dotsBottom} cols={5} rows={5} size={8} gap={12} />

												<figure className={s.media}>
														<img
															className={s.image}
															src={heroImage}
															alt="Дизайнерский полотенцесушитель ErikNar в интерьере ванной"
															width={1024}
															height={1024}
															decoding="async"
															fetchPriority="high"
														/>
												</figure>
										</div>
								</div>
						</LayoutContainer>
				</section>
		);
}
