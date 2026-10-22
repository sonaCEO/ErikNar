import {useId} from "react";
import clsx from "clsx";
import {availabilityLabel} from "../../../catalog/availability";
import {Modal} from "../../ui/modal/modal";
import {TitleGroup} from "../../ui/title-group/title-group";
import {Button} from "../../ui/button/button";
import {Text} from "../../ui/typography/text/text";
import {Badge} from "../../ui/badge/badge";
import {Fact} from "../../ui/fact/fact";
import s from "./details-modal.module.css";

export function DetailsModal({
		open,
		onClose,
		onExited,
		onConsult,
		subtitle = "Подробнее",
		title,
		text,
		paragraphs = [],
		image,
		priceFrom,
		colors = [],
		sizes = [],
		availabilityStatus,
		facts = [],
}) {
		const titleId = useId();
		const statusLabel = availabilityStatus
				? availabilityLabel[availabilityStatus]
				: null;

		return (
				<Modal
						open={open}
						onClose={onClose}
						onExited={onExited}
						labelledBy={titleId}
						className={clsx(s.dialog, image && s.withMedia)}
				>
						<div className={s.content}>
								{image?.src && (
										<figure className={s.media}>
												<img
														className={s.image}
														src={image.src}
														alt={image.alt || title || ""}
														width={image.width}
														height={image.height}
														decoding="async"
												/>
										</figure>
								)}

								<div className={s.body}>
										<div className={s.head}>
												{statusLabel && (
														<Badge variant={availabilityStatus}>{statusLabel}</Badge>
												)}

												<div id={titleId}>
														<TitleGroup
																className={s.heading}
																subtitle={subtitle}
																title={title}
																titleLevel={3}
																text={text}
																textVariant="muted"
														/>
												</div>

												{priceFrom != null && priceFrom !== "" && (
														<Text as="p" variant="strong">
																от {priceFrom}
														</Text>
												)}
										</div>

										{paragraphs.length > 0 && (
												<ul className={s.list}>
														{paragraphs.map((paragraph) => (
																<li key={paragraph}>
																		<Text as="p" variant="base">
																				{paragraph}
																		</Text>
																</li>
														))}
												</ul>
										)}

										{facts.length > 0 && (
												<ul className={s.tiles}>
														{facts.map((fact) => (
																<li key={fact.label} className={s.tile}>
																		<Fact
																				variant="compact"
																				className={s.fact}
																				value={fact.value}
																				unit={fact.unit}
																				label={fact.label}
																		/>
																</li>
														))}
												</ul>
										)}

										{colors.length > 0 && (
												<div className={s.block}>
														<Text as="span" variant="label">Цвета</Text>
														<ul className={s.colors}>
																{colors.map((color) => (
																		<li key={color.id ?? color.hex} className={s.color}>
																				<span
																						className={s.swatch}
																						style={{backgroundColor: color.hex}}
																						aria-hidden="true"
																				/>
																				<Text as="span" variant="base">
																						{color.name}
																				</Text>
																		</li>
																))}
														</ul>
												</div>
										)}

										{sizes.length > 0 && (
												<div className={s.block}>
														<Text as="span" variant="label">Размеры</Text>
														<Text as="p" variant="base">
																{sizes.join(" · ")}
														</Text>
												</div>
										)}

										<Button
												variant="ginger"
												size="lg"
												className={s.cta}
												onClick={onConsult}
										>
												Получить консультацию
										</Button>
								</div>
						</div>
				</Modal>
		);
}
