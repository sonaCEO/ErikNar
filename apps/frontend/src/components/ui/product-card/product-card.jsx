import {useState} from "react";
import {availabilityLabel} from "../../../catalog/availability";
import {useModal} from "../../modals/modal-context";
import {Badge} from "../badge/badge";
import {Button} from "../button/button";
import {Text} from "../typography/text/text";
import {Title} from "../typography/title/title";
import {Image} from "../image/image";
import {ColorPicker} from "../color-picker/color-picker";
import {getBodyColors, getSizes, selectVariant, sortMedia} from "../../../utils/variant";
import {formatPriceMinor, formatSizeMm} from "../../../utils/format";
import s from "./product-card.module.css";

export function ProductCard({product, relatedProducts = []}) {
		const {openModal} = useModal();
		const [selectedId, setSelectedId] = useState(null);
		const variants = product.variants;
		const variant = variants.find((item) => item.id === selectedId) ?? variants[0];
		const colors = getBodyColors(variants);
		const sizes = getSizes(variants);
		const activeColor = variant?.body_color;
		const media = sortMedia(variant?.media ?? [])[0];
		const imageUrl = media?.url ?? (!variant ? product.primary_image_url : undefined);
		const statusLabel = availabilityLabel[variant?.availability_status];
		const name = product.name;
		const description = product.short_description;

		function select(changes) {
				setSelectedId(selectVariant(variants, variant, changes)?.id ?? null);
		}

		function openDetails() {
				openModal("product", {product, initialVariantId: variant?.id, relatedProducts});
		}

		return (
				<article className={s.card}>
						<button
								type="button"
								className={s.media}
								aria-label={name ? `Подробнее: ${name}` : "Подробнее"}
								onClick={openDetails}
						>
								<Image key={imageUrl} src={imageUrl} alt={media?.alt_text || name} className={s.image} width={1024}
											 height={1024}/>
						</button>

						<div className={s.body}>
								{statusLabel && (
										<Badge variant={variant.availability_status}>{statusLabel}</Badge>
								)}

								<div className={s.head}>
										{name && (
												<div className={s.name}>
														<Title level={3}>{name}</Title>
												</div>
										)}
										{variant && (
												<span className={s.price}>
														<Text as="span" variant="strong">
																{formatPriceMinor(variant.price_minor, variant.currency)}
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

								<ColorPicker colors={colors} value={activeColor?.id} onChange={(bodyColorId) => select({bodyColorId})}/>

								{sizes.length > 0 && (
										<div className={s.field}>
												<Text as="span" variant="label">Размер</Text>
												<div className={s.chips} role="group" aria-label="Размер">
														{sizes.map((size) => (
																<Button
																		key={`${size.width_mm}x${size.height_mm}`}
																		variant="soft"
																		size="mini"
																		active={variant?.width_mm === size.width_mm && variant?.height_mm === size.height_mm}
																		onClick={() => select({widthMm: size.width_mm, heightMm: size.height_mm})}
																>
																		{formatSizeMm(size.width_mm, size.height_mm)}
																</Button>
														))}
												</div>
										</div>
								)}

								<Button
										variant="black"
										size="sm"
										className={s.cta}
										onClick={openDetails}
								>
										Подробнее
								</Button>
						</div>
				</article>
		);
}
