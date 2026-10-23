import {useEffect, useId, useRef, useState} from "react";
import clsx from "clsx";
import {ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ImageOff, ShieldCheck, Thermometer} from "lucide-react";
import {useProduct} from "../../../hooks/queries/use-products";
import {
		formatPriceMinor,
		formatSizeMm,
		formatWarrantyMonths,
} from "../../../utils/format";
import {
		selectVariant,
		getBodyColors,
		getControlTypes,
		getSizes,
		sortMedia,
} from "../../../utils/variant";
import {availabilityLabel, AvailabilityStatus} from "../../../catalog/availability";
import {Modal} from "../../ui/modal/modal";
import {Gallery} from "../../ui/gallery/gallery";
import {Button} from "../../ui/button/button";
import {Text} from "../../ui/typography/text/text";
import {Title} from "../../ui/typography/title/title";
import {Badge} from "../../ui/badge/badge";
import {Image} from "../../ui/image/image";
import {ColorPicker} from "../../ui/color-picker/color-picker";
import s from "./product-modal.module.css";

export function ProductModal({
		 open,
		 onClose,
		 onExited,
		 onConsult,
		 onOpenProduct,
		 product: initialProduct,
		 initialVariantId,
		 relatedProducts = [],
}) {
		const titleId = useId();
		const controlId = useId();
		const contentRef = useRef(null);
		const productQuery = useProduct(initialProduct.slug);
		const product = productQuery.data ?? initialProduct;
		const [selectedId, setSelectedId] = useState(initialVariantId ?? product.variants[0]?.id);
		const [mediaIndex, setMediaIndex] = useState(0);
		const [prevProductId, setPrevProductId] = useState(product.id);

		if (product.id !== prevProductId) {
				setPrevProductId(product.id);
				setSelectedId(initialVariantId ?? product.variants[0]?.id);
				setMediaIndex(0);
		}

		const bodyColors = getBodyColors(product.variants);
		const sizes = getSizes(product.variants);
		const controls = getControlTypes(product.variants);
		const variant = product.variants.find((item) => item.id === selectedId) ?? product.variants[0];
		const sameColor = product.variants.filter((item) => item.body_color.id === variant?.body_color.id);
		const sameSize = sameColor.filter((item) => item.width_mm === variant?.width_mm && item.height_mm === variant?.height_mm);
		const sameControl = sameSize.filter((item) => item.control_type.id === variant?.control_type.id);
		const panelColors = [...new Map(sameControl.map((item) => [item.panel_color.id, item.panel_color])).values()];
		const media = sortMedia(variant?.media ?? []);
		const activeMediaIndex = Math.min(mediaIndex, Math.max(media.length - 1, 0));
		const statusLabel = availabilityLabel[variant?.availability_status];
		const activeColor = variant?.body_color;
		const similar = relatedProducts.filter((item) => item.id !== product.id).slice(0, 3);
		const canOrder = Boolean(variant && [AvailabilityStatus.IN_STOCK, AvailabilityStatus.MADE_TO_ORDER].includes(variant.availability_status));

		const specs = [
				{label: "Артикул", value: variant?.sku ?? product.model_code},
				{label: "Нагреватель", value: product.heater_type},
				{label: "Макс. нагрев", value: `${product.max_temperature} °C`},
				{label: "Гарантия", value: `${product.warranty_months} мес.`},
		];

		useEffect(() => {
				contentRef.current?.scrollTo({top: 0});
		}, [product.id]);

		function select(changes) {
				setSelectedId(selectVariant(product.variants, variant, changes)?.id);
				setMediaIndex(0);
		}

		function handleOrder() {
				if (!canOrder || productQuery.isFetching || productQuery.isError) return;
				onConsult?.({
						variantId: variant?.id,
						productName: product.name,
						sku: variant?.sku,
				});
		}

		return (
				<Modal
						open={open}
						onClose={onClose}
						onExited={onExited}
						labelledBy={titleId}
						className={s.dialog}
						rootClassName={s.viewport}
						closeClassName={s.close}
				>
						<header className={s.header}>
								<Text as="span" variant="subtitle" className={s.category}>{product.category}</Text>
								<div id={titleId} className={s.title}><Title level={2}>{product.name}</Title></div>
								<div className={s.meta}>
										<span>Модель {product.model_code}</span>
										{statusLabel && <Badge variant={variant.availability_status}>{statusLabel}</Badge>}
								</div>
						</header>

						<div className={s.content} ref={contentRef}>
								<div className={s.main}>
										<div className={s.galleryCol}>
												{media.length ? (
														<>
																<Gallery
																		className={s.gallery}
																		items={media}
																		activeIndex={activeMediaIndex}
																		onSelect={setMediaIndex}
																		fit="contain"
																/>
																{media.length > 1 && (
																		<div className={s.mediaNav}>
																				<span>Фото {activeMediaIndex + 1} из {media.length}</span>
																				<div className={s.mediaButtons}>
																						<Button
																								size="compact"
																								variant="soft"
																								aria-label="Предыдущее фото"
																								disabled={activeMediaIndex === 0}
																								onClick={() => setMediaIndex(activeMediaIndex - 1)}
																						>
																								<ChevronLeft size={16} />
																						</Button>
																						<Button
																								size="compact"
																								variant="soft"
																								aria-label="Следующее фото"
																								disabled={activeMediaIndex === media.length - 1}
																								onClick={() => setMediaIndex(activeMediaIndex + 1)}
																						>
																								<ChevronRight size={16} />
																						</Button>
																				</div>
																		</div>
																)}
														</>
												) : (
														<div className={s.emptyMedia}>
																<ImageOff size={32} aria-hidden="true" />
																<span>Фото выбранной комплектации пока нет</span>
														</div>
												)}
												<div className={s.features}>
														<span><ShieldCheck size={17} aria-hidden="true" />{formatWarrantyMonths(product.warranty_months)}</span>
														<span><Thermometer size={17} aria-hidden="true" />Нагрев до {product.max_temperature} °C</span>
												</div>
										</div>

										<div className={s.info}>
												<Text as="p" variant="muted" className={s.lead}>{product.short_description}</Text>
												{productQuery.error && (
														<div className={s.error} role="alert">
																<p>Не удалось обновить данные модели.</p>
																<Button
																		size="compact"
																		variant="soft"
																		isLoading={productQuery.isFetching}
																		onClick={() => productQuery.refetch()}
																>
																		Повторить
																</Button>
														</div>
												)}
												{variant ? (
														<>
																<ColorPicker
																		colors={bodyColors}
																		value={activeColor.id}
																		onChange={(bodyColorId) => select({ bodyColorId })}
																/>

																<div className={s.field}>
																		<div className={s.optionTitle}>
																				<Text as="span" variant="label">Размер</Text>
																				<span>Высота × ширина, мм</span>
																		</div>
																		<div className={s.chips} role="group" aria-label="Размер">
																				{sizes.map((size) => {
																						const available = sameColor.some(
																								(item) => item.width_mm === size.width_mm && item.height_mm === size.height_mm
																						);
																						return (
																								<Button
																										key={`${size.width_mm}x${size.height_mm}`}
																										variant="soft"
																										size="compact"
																										active={size.width_mm === variant.width_mm && size.height_mm === variant.height_mm}
																										disabled={!available}
																										title={available ? undefined : "Недоступно в выбранном цвете"}
																										onClick={() =>
																												select({
																														bodyColorId: variant.body_color.id,
																														widthMm: size.width_mm,
																														heightMm: size.height_mm,
																												})
																										}
																								>
																										{formatSizeMm(size.width_mm, size.height_mm)}
																								</Button>
																						);
																				})}
																		</div>
																</div>

																<div className={s.field} role="radiogroup" aria-label="Тип управления">
																		<Text as="span" variant="label">Тип управления</Text>
																		<div className={s.controls}>
																				{controls.map((control) => {
																						const active = control.id === variant.control_type.id;
																						const available = sameSize.some((item) => item.control_type.id === control.id);
																						return (
																								<label
																										key={control.id}
																										className={clsx(s.control, active && s.controlActive, !available && s.controlDisabled)}
																								>
																										<input
																												type="radio"
																												name={controlId}
																												value={control.id}
																												checked={active}
																												disabled={!available}
																												onChange={() =>
																														select({
																																bodyColorId: variant.body_color.id,
																																widthMm: variant.width_mm,
																																heightMm: variant.height_mm,
																																controlTypeId: control.id,
																														})
																												}
																										/>
																										<span className={s.controlBody}>
                             <span className={s.controlName}>{control.name}</span>
																												{control.description && <span className={s.controlDesc}>{control.description}</span>}
                           </span>
																								</label>
																						);
																				})}
																		</div>
																</div>

																{panelColors.length > 1 && (
																		<div className={s.field}>
																				<Text as="span" variant="label">Цвет панели</Text>
																				<div className={s.chips} role="group" aria-label="Цвет панели">
																						{panelColors.map((color) => (
																								<Button
																										key={color.id}
																										size="compact"
																										variant="soft"
																										active={color.id === variant.panel_color.id}
																										onChange={() => {}}
																										onClick={() =>
																												select({
																														bodyColorId: variant.body_color.id,
																														widthMm: variant.width_mm,
																														heightMm: variant.height_mm,
																														controlTypeId: variant.control_type.id,
																														panelColorId: color.id,
																												})
																										}
																								>
																										{color.name}
																								</Button>
																						))}
																				</div>
																		</div>
																)}
														</>
												) : (
														<Text as="p" variant="muted">Заказ этой модели пока недоступен.</Text>
												)}
										</div>
								</div>

								<div className={s.information}>
										<details className={s.details}>
												<summary>Описание<ChevronDown size={16} aria-hidden="true" /></summary>
												<Text as="p" variant="muted" className={s.description}>{product.description}</Text>
										</details>
										<details className={s.details}>
												<summary>Характеристики<ChevronDown size={16} aria-hidden="true" /></summary>
												<dl className={s.specs}>
														{specs.map((spec) => (
																<div key={spec.label} className={s.spec}>
																		<dt>{spec.label}</dt>
																		<dd>{spec.value}</dd>
																</div>
														))}
												</dl>
										</details>
								</div>

								{similar.length > 0 && (
										<section className={s.section}>
												<Title level={3}>Другие модели</Title>
												<ul className={s.similar}>
														{similar.map((item) => {
																const preview = item.variants[0];
																const image = sortMedia(preview?.media ?? [])[0];
																return (
																		<li key={item.id}>
																				<button type="button" className={s.similarCard} onClick={() => onOpenProduct?.(item)}>
																						<Image className={s.similarImage} src={image?.url} alt="" fit="contain" />
																						<span className={s.similarBody}>
                         <span className={s.similarName}>{item.name}</span>
																								{preview && (
																										<span className={s.similarPrice}>
                             {formatPriceMinor(preview.price_minor, preview.currency)}
                           </span>
																								)}
                       </span>
																						<ChevronRight size={16} aria-hidden="true" />
																				</button>
																		</li>
																);
														})}
												</ul>
										</section>
								)}
						</div>

						<footer className={s.purchase}>
								{variant ? (
										<>
												<div className={s.purchasePrice} aria-live="polite">
														<Text as="span" variant="muted" className={s.priceLabel}>Стоимость комплектации</Text>
														<Text as="p" variant="strong" className={s.total}>
																{formatPriceMinor(variant.price_minor, variant.currency)}
														</Text>
														<span className={s.selectionSummary}>
                 {formatSizeMm(variant.width_mm, variant.height_mm)} мм · {activeColor.name}
               </span>
												</div>
												<Button
														variant="ginger"
														size="md"
														className={s.orderButton}
														onClick={handleOrder}
														isLoading={productQuery.isFetching}
														disabled={!canOrder || productQuery.isError}
												>
														{canOrder ? "Заказать модель" : "Нет в наличии"}
														<ArrowRight size={17} aria-hidden="true" />
												</Button>
										</>
								) : (
										<Button variant="soft" size="compact" onClick={onClose}>Вернуться в каталог</Button>
								)}
						</footer>
				</Modal>
		);
}