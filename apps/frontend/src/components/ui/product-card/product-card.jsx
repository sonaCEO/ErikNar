import clsx from "clsx";
import {availabilityLabel} from "../../../catalog/availability";
import {useModal} from "../../modals/modal-context";
import {Badge} from "../badge/badge";
import {Button} from "../button/button";
import {Text} from "../typography/text/text";
import {Title} from "../typography/title/title";
import s from "./product-card.module.css";

export function ProductCard({
		image,
		name,
		priceFrom,
		description,
		colors = [],
		sizes = [],
		availabilityStatus,
}) {
		const {openModal} = useModal();
		const activeColor = colors[0];
		const statusLabel = availabilityLabel[availabilityStatus];

		return (
				<article className={s.card}>
						<div className={s.media}>
								{image?.src && (
										<img
											className={s.image}
											src={image.src}
											alt={image.alt || name || ""}
											width={image.width}
											height={image.height}
											loading="lazy"
											decoding="async"
										/>
								)}
						</div>

						<div className={s.body}>
								{statusLabel && (
										<Badge variant={availabilityStatus}>{statusLabel}</Badge>
								)}

								<div className={s.head}>
										{name && (
												<div className={s.name}>
														<Title level={3}>{name}</Title>
												</div>
										)}
										{priceFrom != null && priceFrom !== "" && (
												<span className={s.price}>
														<Text as="span" variant="strong">
																от {priceFrom}
														</Text>
												</span>
										)}
								</div>

								{description && (
										<div className={s.field}>
												<Text as="span" variant="label">Описание</Text>
												<div className={s.description}>
														<Text as="p" variant="muted">{description}</Text>
												</div>
										</div>
								)}

								{colors.length > 0 && (
										<div className={s.field}>
												<Text as="span" variant="label">
														Цвет{activeColor?.name ? ` (${activeColor.name})` : ""}
												</Text>
												<div className={s.swatches} aria-hidden="true">
														{colors.map((color, index) => (
																<span
																	key={color.id ?? color.hex ?? index}
																	className={clsx(s.swatch, index === 0 && s.swatchActive)}
																	title={color.name}
																>
																		<span
																			className={s.swatchFill}
																			style={{backgroundColor: color.hex}}
																		/>
																</span>
														))}
												</div>
										</div>
								)}

								{sizes.length > 0 && (
										<div className={s.field}>
												<Text as="span" variant="label">Размер</Text>
												<div className={s.chips} role="group" aria-label="Размер">
														{sizes.map((size, index) => (
																<Button
																	key={size}
																	variant="soft"
																	size="mini"
																	active={index === 0}
																	tabIndex={-1}
																>
																		{size}
																</Button>
														))}
												</div>
										</div>
								)}

								<Button
										variant="black"
										size="sm"
										className={s.cta}
										onClick={() => openModal("details", {
												subtitle: "Модель",
												title: name,
												text: description,
												image,
												priceFrom,
												colors,
												sizes,
												availabilityStatus,
										})}
								>
										Подробнее
								</Button>
						</div>
				</article>
		);
}
