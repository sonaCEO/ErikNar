import clsx from "clsx";
import LayoutContainer from "../../grid/layout-container/layout-container";
import {TitleGroup} from "../../ui/title-group/title-group";
import {Text} from "../../ui/typography/text/text";
import {Title} from "../../ui/typography/title/title";
import {spaces, spacesMeta} from "./data";
import s from "./spaces.module.css";

function SpaceCard({item, className}) {
		return (
				<article className={clsx(s.card, className)}>
						<img
								className={s.image}
								src={item.image.src}
								alt={item.image.alt}
								width={item.image.width}
								height={item.image.height}
								loading="lazy"
								decoding="async"
						/>
						<span className={s.shade} aria-hidden="true"/>
						<Text as="span" variant="caption" className={s.number}>
								{item.number}
						</Text>
						<div className={s.body}>
								<Title level={3} variant="white">
										{item.title}
								</Title>
								<Text as="p" variant="caption" className={s.desc}>
										{item.text}
								</Text>
						</div>
				</article>
		);
}

export function Spaces() {
		const [bathroom, hallway, laundry, kitchen] = spaces;

		return (
				<section className={s.spaces} id="spaces">
						<LayoutContainer>
								<div className={s.inner}>
										<div className={s.heading}>
												<TitleGroup
														subtitle={spacesMeta.subtitle}
														title={spacesMeta.title}
														titleLevel={2}
												/>
										</div>

										<div className={s.mosaic}>
												<SpaceCard item={bathroom} className={s.bathroom}/>
												<SpaceCard item={hallway} className={s.hallway}/>
												<div className={s.stack}>
														<SpaceCard item={laundry} className={s.half}/>
														<SpaceCard item={kitchen} className={s.half}/>
												</div>
										</div>
								</div>
						</LayoutContainer>
				</section>
		);
}
