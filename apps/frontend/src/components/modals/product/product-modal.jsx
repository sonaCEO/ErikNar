import {useId, useState} from "react";
import {
		formatPriceMinor,
		formatSizeMm,
		formatWarrantyMonths,
} from "../../../utils/format";
import {
		findVariant,
		getBodyColors,
		getControlTypes,
		getSizes,
		sortMedia,
} from "../../../utils/variant";
import {availabilityLabel} from "../../../catalog/availability";
import {getSimilarProducts} from "../../../catalog/mock-products";
import {Modal} from "../../ui/modal/modal";
import {Gallery} from "../../ui/gallery/gallery";
import {Button} from "../../ui/button/button";
import {Text} from "../../ui/typography/text/text";
import {Title} from "../../ui/typography/title/title";
import {Badge} from "../../ui/badge/badge";
import s from "./product-modal.module.css";

function initialSelection(product) {
		const first = product.variants[0];
		return {
				bodyColorId: first.body_color.id,
				widthMm: first.width_mm,
				heightMm: first.height_mm,
				controlTypeId: first.control_type.id,
		};
}

export function ProductModal({
		open,
		onClose,
		onExited,
		onConsult,
		onOpenProduct,
		product,
}) {
		const titleId = useId();
		const [selection, setSelection] = useState(() => initialSelection(product));
		const [mediaIndex, setMediaIndex] = useState(0);
		const [prevProductId, setPrevProductId] = useState(product.id);

		if (product.id !== prevProductId) {
				setPrevProductId(product.id);
				setSelection(initialSelection(product));
				setMediaIndex(0);
		}

		const bodyColors = getBodyColors(product.variants);
		const sizes = getSizes(product.variants);
		const controls = getControlTypes(product.variants);
		const variant = findVariant(product.variants, selection) ?? product.variants[0];
		const media = sortMedia(variant.media);
		const activeMediaIndex = Math.min(mediaIndex, Math.max(media.length - 1, 0));
		const statusLabel = availabilityLabel[variant.availability_status];
		const activeColor = bodyColors.find((color) => color.id === selection.bodyColorId);
		const similar = getSimilarProducts(product.slug, 3);

		const specs = [
				{label: "Тип", value: "Электрический"},
				{label: "Теплоноситель", value: product.heater_type},
				{label: "Макс. нагрев", value: `${product.max_temperature} °C`},
				{label: "Покрытие", value: "Порошковое, матовое"},
				{label: "Монтаж", value: "Настенный, вертикальный"},
				{label: "Комплектация", value: "Крючки, крепления, кабель"},
		];

		function selectBodyColor(bodyColorId) {
				setSelection((prev) => ({...prev, bodyColorId}));
				setMediaIndex(0);
		}

		function selectSize(size) {
				setSelection((prev) => ({
						...prev,
						widthMm: size.width_mm,
						heightMm: size.height_mm,
				}));
		}

		function selectControl(controlTypeId) {
				setSelection((prev) => ({...prev, controlTypeId}));
		}

		function handleOrder() {
				onConsult?.({
						variantId: variant.id,
						productName: product.name,
						sku: variant.sku,
				});
		}

		return (
				<Modal
						open={open}
						onClose={onClose}
						onExited={onExited}
						labelledBy={titleId}
						className={s.dialog}
				>
						<div className={s.content}>
								<div className={s.main}>
										<div className={s.galleryCol}>
												{statusLabel && (
														<span className={s.badge}>
																<Badge variant={variant.availability_status}>
																		{statusLabel}
																</Badge>
														</span>
												)}
												<Gallery
														items={media}
														activeIndex={activeMediaIndex}
														onSelect={setMediaIndex}
												/>
										</div>

										<div className={s.info}>
												<div id={titleId} className={s.head}>
														<Text as="span" variant="subtitle">{product.category}</Text>
														<Title level={3}>{product.name}</Title>
														<Text as="p" variant="muted" className={s.lead}>
																{product.short_description}
														</Text>
												</div>

												<div className={s.priceBlock}>
														<Text as="p" variant="strong">
																{formatPriceMinor(variant.price_minor, variant.currency)}
														</Text>
														<Text as="span" variant="caption">
																{formatWarrantyMonths(product.warranty_months)}
														</Text>
												</div>

												<div className={s.field}>
														<Text as="span" variant="label">
																Цвет{activeColor ? ` · ${activeColor.name}` : ""}
														</Text>
														<div className={s.swatches} role="listbox" aria-label="Цвет корпуса">
																{bodyColors.map((color) => {
																		const active = color.id === selection.bodyColorId;
																		return (
																				<button
																						key={color.id}
																						type="button"
																						className={s.swatch}
																						role="option"
																						aria-selected={active}
																						aria-label={color.name}
																						title={color.name}
																						onClick={() => selectBodyColor(color.id)}
																				>
																						<span
																								className={s.swatchFill}
																								style={{backgroundColor: color.hex_value}}
																						/>
																				</button>
																		);
																})}
														</div>
												</div>

												{sizes.length > 1 && (
														<div className={s.field}>
																<Text as="span" variant="label">Размер</Text>
																<div className={s.chips} role="group" aria-label="Размер">
																		{sizes.map((size) => {
																				const active = (
																						size.width_mm === selection.widthMm
																						&& size.height_mm === selection.heightMm
																				);
																				return (
																						<Button
																								key={`${size.width_mm}x${size.height_mm}`}
																								variant="soft"
																								size="sm"
																								active={active}
																								onClick={() => selectSize(size)}
																						>
																								{formatSizeMm(size.width_mm, size.height_mm)}
																						</Button>
																				);
																		})}
																</div>
														</div>
												)}

												<div className={s.field}>
														<Text as="span" variant="label">Тип управления</Text>
														<div className={s.controls}>
																{controls.map((control) => {
																		const active = control.id === selection.controlTypeId;
																		return (
																				<button
																						key={control.id}
																						type="button"
																						className={s.control}
																						aria-pressed={active}
																						onClick={() => selectControl(control.id)}
																				>
																						<span className={s.controlName}>{control.name}</span>
																						<span className={s.controlDesc}>{control.description}</span>
																				</button>
																		);
																})}
														</div>
												</div>

												<Button
														variant="ginger"
														size="md"
														className={s.cta}
														onClick={handleOrder}
												>
														Заказать модель
												</Button>
										</div>
								</div>

								<section className={s.section}>
										<Text as="span" variant="subtitle">Характеристики</Text>
										<dl className={s.specs}>
												{specs.map((spec) => (
														<div key={spec.label} className={s.spec}>
																<dt>{spec.label}</dt>
																<dd>{spec.value}</dd>
														</div>
												))}
										</dl>
								</section>

								{similar.length > 0 && (
										<section className={s.section}>
												<Text as="span" variant="subtitle">Похожие модели</Text>
												<ul className={s.similar}>
														{similar.map((item) => {
																const preview = item.variants[0];
																const image = sortMedia(preview.media)[0];
																return (
																		<li key={item.id} className={s.similarItem}>
																				<button
																						type="button"
																						className={s.similarCard}
																						onClick={() => onOpenProduct?.(item)}
																				>
																						{image && (
																								<img
																										className={s.similarImage}
																										src={image.url}
																										alt=""
																										decoding="async"
																								/>
																						)}
																						<span className={s.similarBody}>
																								<span className={s.similarName}>{item.name}</span>
																								<span className={s.similarPrice}>
																										от {formatPriceMinor(preview.price_minor, preview.currency)}
																								</span>
																						</span>
																				</button>
																		</li>
																);
														})}
												</ul>
										</section>
								)}
						</div>
				</Modal>
		);
}
