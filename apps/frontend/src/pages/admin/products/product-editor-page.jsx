import {useEffect, useRef, useState} from "react";
import {Link, useNavigate, useParams} from "react-router";
import {useQueryClient} from "@tanstack/react-query";
import {Archive, ArrowLeft, Plus, Save, X} from "lucide-react";
import {toast} from "sonner";
import {
		archiveProduct,
		createCatalogOption,
		createProduct,
		createVariant,
		deleteProductMedia,
		updateProduct,
		updateProductMedia,
		updateVariant,
		uploadProductMedia,
} from "../../../api/admin/catalog";
import {useAdminProduct, useAdminVariants, useCatalogMutation, useCatalogOptions, useProductMedia} from "../../../hooks/queries/use-admin-catalog";
import {queryKeys} from "../../../hooks/queries/query-keys";
import {Button} from "../../../components/ui/button/button";
import {Input} from "../../../components/ui/input/input";
import {Textarea} from "../../../components/ui/textarea/textarea";
import {Title} from "../../../components/ui/typography/title/title";
import {ConfirmDialog, FormError, RequestState} from "../admin-ui";

const EMPTY_ROWS = [];
const EMPTY_MEDIA = [];
import {
		integer,
		MAX_INTEGER,
		minorToPrice,
		priceToMinor,
		CATEGORY_EXAMPLE,
		productDraft,
		productPayload,
} from "./product-form";
import {ColorGallery} from "./color-gallery";
import {activeRows, buildOffer, CONTROL_CHOICES, slugify, uniqueBy} from "./product-offer";
import s from "../admin.module.css";
import p from "./products.module.css";

function byName(list, name) {
		const needle = name.trim().toLowerCase();
		return list.find((item) => item.name.trim().toLowerCase() === needle);
}

function labelOf(list, id) {
		return list.find((item) => item.id === id)?.name ?? "Без названия";
}

async function ensureOption(resource, list, name, extra) {
		const found = byName(list, name);
		if (found) return found;
		const body = {name: name.trim(), slug: slugify(name), ...extra};
		if (resource === "control-types" && body.description === undefined) body.description = "";
		return createCatalogOption(resource, body);
}

function photoData(file, alt, colorId, primary, sortOrder) {
		const body = new FormData();
		body.append("file", file);
		body.append("alt_text", alt);
		body.append("sort_order", String(sortOrder));
		body.append("is_primary", String(primary));
		if (colorId) body.append("body_color_id", colorId);
		return body;
}

function groupsFromCatalog(media, colors, panelColors, rows) {
		const groups = new Map();
		const activeVariants = rows.filter((row) => row.is_active !== false);
		function groupFor(colorId) {
				if (!groups.has(colorId)) {
						const color = colors.find((entry) => entry.id === colorId);
						const variant = activeVariants.find((entry) => entry.body_color_id === colorId);
						groups.set(colorId, {
								key: colorId,
								colorId,
								name: color?.name || "",
								hex: color?.hex_value || "#20201F",
								panelName: panelColors.find((entry) => entry.id === variant?.panel_color_id)?.name || "",
								photos: [],
						});
				}
				return groups.get(colorId);
		}
		for (const item of [...media].sort((a, b) => a.sort_order - b.sort_order || String(a.created_at).localeCompare(String(b.created_at)))) {
				if (!item.body_color_id) continue;
				groupFor(item.body_color_id).photos.push({
						key: item.id,
						mediaId: item.id,
						preview: item.url,
						updatedAt: item.updated_at,
						sortOrder: item.sort_order,
				});
		}
		for (const row of activeVariants) {
				if (row.body_color_id) groupFor(row.body_color_id);
		}
		return [...groups.values()];
}

async function refreshCatalog(client, product) {
		const tasks = [
				client.invalidateQueries({queryKey: queryKeys.adminVariants(product.id)}),
				client.invalidateQueries({queryKey: queryKeys.adminMedia(product.id)}),
				client.invalidateQueries({queryKey: queryKeys.adminBodyColors}),
				client.invalidateQueries({queryKey: queryKeys.adminPanelColors}),
				client.invalidateQueries({queryKey: queryKeys.adminControlTypes}),
				client.invalidateQueries({queryKey: queryKeys.products}),
		];
		if (product.slug) tasks.push(client.invalidateQueries({queryKey: queryKeys.product(product.slug)}));
		await Promise.all(tasks);
}

function ProductFields({field, onCategory}) {
		return (
				<section className={s.card}>
						<div className={p.sectionIntro}>
								<Title level={3}>Описание товара</Title>
								<p>Название, код и информация, которую увидит покупатель.</p>
						</div>
						<div className={s.grid}>
								<Input compact label="Название" required maxLength={200} {...field("name")} />
								<Input compact label="Код модели" required maxLength={80} placeholder="EN-600" {...field("model_code")} />
								<label className={p.category}>
										<span>
												Категория (
												<button type="button" className={p.example} onClick={() => onCategory(CATEGORY_EXAMPLE)}>
														например {CATEGORY_EXAMPLE}
												</button>
												)
										</span>
										<input maxLength={80} {...field("category")} />
								</label>
						</div>
						<div className={s.grid}>
								<Textarea compact label="Краткое описание" required maxLength={500} rows={4} {...field("short_description")} />
								<Textarea compact label="Полное описание" required rows={4} {...field("description")} />
						</div>
						<div className={p.trio}>
								<Input compact label="Тип нагревателя" required maxLength={120} placeholder="Сухой ТЭН" {...field("heater_type")} />
								<Input compact label="Максимальная температура, °C" type="number" required min={1} max={MAX_INTEGER} step={1} {...field("max_temperature")} />
								<Input compact label="Гарантия, месяцев" type="number" required min={0} max={MAX_INTEGER} step={1} {...field("warranty_months")} />
						</div>
				</section>
		);
}

function Chip({children, onRemove, label}) {
		return (
				<span className={p.chip}>
						{children}
						{onRemove && (
								<button type="button" aria-label={label} onClick={onRemove}><X size={14} /></button>
						)}
				</span>
		);
}

function NewSale({sizes, setSizes, bodies, setBodies, controls, setControls, price, setPrice, uploading}) {
		const [width, setWidth] = useState("");
		const [height, setHeight] = useState("");
		const [customControl, setCustomControl] = useState("");
		const [error, setError] = useState(null);

		function addSize() {
				setError(null);
				try {
						const next = {width: integer(width, "Ширина", 1), height: integer(height, "Высота", 1)};
						if (sizes.some((size) => size.width === next.width && size.height === next.height)) throw new Error("Такой размер уже есть.");
						setSizes((current) => [...current, next]);
						setWidth("");
						setHeight("");
				} catch (err) {
						setError(err);
				}
		}

		function toggleControl(name) {
				setControls((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
		}

		function addControl() {
				const name = customControl.trim();
				if (!name || controls.includes(name)) return;
				setControls((current) => [...current, name]);
				setCustomControl("");
		}

		const choices = [...CONTROL_CHOICES, ...controls.filter((name) => !CONTROL_CHOICES.includes(name))];

		return (
				<div className={p.sale}>
						<div className={p.saleGroup}>
								<div className={p.sectionIntro}>
										<h4>Цена</h4>
										<p>Цена будет общей для всех комплектаций.</p>
								</div>
								<div className={p.line}>
										<Input
											compact
											className={p.narrow}
											label="Цена, ₽"
											inputMode="decimal"
											required
											placeholder="12600"
											value={price}
											onChange={(event) => setPrice(event.target.value)}
										/>
								</div>
						</div>
						<div className={p.saleGroup}>
								<div className={p.sectionIntro}>
										<h4>Размеры</h4>
										<p>Добавьте все доступные ширину и высоту в миллиметрах.</p>
								</div>
								<div className={p.line}>
										<Input compact className={p.narrow} label="Ширина" type="number" min={1} max={MAX_INTEGER} value={width} onChange={(event) => setWidth(event.target.value)} />
										<Input compact className={p.narrow} label="Высота" type="number" min={1} max={MAX_INTEGER} value={height} onChange={(event) => setHeight(event.target.value)} />
										<Button type="button" size="compact" variant="ginger" onClick={addSize}>
												<Plus size={13} /> Добавить размер
										</Button>
								</div>
								<div className={p.chips}>
										{sizes.map((size) => (
												<Chip
													key={`${size.width}x${size.height}`}
													label={`Убрать ${size.width} на ${size.height}`}
													onRemove={() => setSizes((current) => current.filter((item) => item !== size))}
												>
														{size.width} × {size.height}
												</Chip>
										))}
								</div>
						</div>
						<div className={p.saleGroup}>
								<div className={p.sectionIntro}>
										<h4>Управление</h4>
										<p>Выберите готовый тип или добавьте свой.</p>
								</div>
								<div className={p.line}>
										<div className={p.chips}>
												{choices.map((name) => (
														<label key={name} className={s.checkbox}>
																<input type="checkbox" checked={controls.includes(name)} onChange={() => toggleControl(name)} />
																{name}
														</label>
												))}
										</div>
										<Input compact className={p.narrow} label="Своё" maxLength={120} value={customControl} onChange={(event) => setCustomControl(event.target.value)} />
										<Button type="button" size="compact" variant="ginger" onClick={addControl}>
												<Plus size={13} /> Добавить
										</Button>
								</div>
						</div>
						<div className={p.saleGroup}>
								<div className={p.sectionIntro}>
										<h4>Цвет корпуса и панели</h4>
										<p>Для каждого цвета корпуса укажите свой цвет панели и добавьте фотографии.</p>
								</div>
								<ColorGallery groups={bodies} onChange={setBodies} onError={setError} uploading={uploading} />
						</div>
						<FormError error={error} />
				</div>
		);
}

function LiveSale({product, rows, media, options, price, setPrice, commitRef, uploading}) {
		const client = useQueryClient();
		const [width, setWidth] = useState("");
		const [height, setHeight] = useState("");
		const [controlName, setControlName] = useState("");
		const [shots, setShots] = useState([]);
		const dropped = useRef(new Set());
		const [error, setError] = useState(null);
		const [pending, setPending] = useState(false);
		const shown = activeRows(rows);
		const sizes = uniqueBy(shown, (row) => `${row.width_mm}x${row.height_mm}`);
		const colors = uniqueBy(shown, (row) => row.body_color_id);
		const controls = uniqueBy(shown, (row) => row.control_type_id);
		const mediaSignature = media.map((item) => `${item.id}:${item.sort_order}:${item.updated_at}`).join("|");
		const colorSignature = options.body_color.map((item) => `${item.id}:${item.name}:${item.hex_value}`).join("|");
		const panelSignature = options.panel_color.map((item) => `${item.id}:${item.name}`).join("|");
		const signature = `${mediaSignature}#${colorSignature}#${panelSignature}#${rows.map((row) => `${row.id}:${row.panel_color_id}:${row.is_active}`).join("|")}`;
		useEffect(() => {
				setShots((current) => {
						const saved = groupsFromCatalog(media, options.body_color, options.panel_color, rows);
						for (const group of saved) {
								const local = current.find((item) => item.colorId === group.colorId);
								const drafts = local?.photos.filter((photo) => photo.file && !dropped.current.has(photo.key)) ?? [];
								group.photos = [...group.photos, ...drafts];
						}
						const pending = current.filter((group) => !group.colorId && !dropped.current.has(group.key));
						return [...saved, ...pending];
				});
		}, [signature, media, options.body_color, options.panel_color, rows]);

		useEffect(() => {
				commitRef.current = async () => {
				for (const group of shots) {
						const drafts = group.photos.filter((photo) => photo.file && !dropped.current.has(photo.key));
						const name = group.name.trim();
						if (!group.colorId && !name) {
								if (drafts.length) throw new Error("Укажите название цвета.");
								continue;
						}
						const nextPanelName = group.panelName?.trim();
						if (!nextPanelName) throw new Error(`Укажите цвет панели для цвета корпуса «${name || "без названия"}».`);
						let colorId = group.colorId;
						if (!colorId) {
								const color = await ensureOption("body-colors", options.body_color, name, {hex_value: group.hex});
								colorId = color.id;
						}
						const panel = await ensureOption("panel-colors", options.panel_color, nextPanelName);
						for (const size of sizes) {
								for (const control of controls) {
										await place({
												size: {width: size.width_mm, height: size.height_mm},
												colorId,
												controlId: control.control_type_id,
												panelId: panel.id,
										});
								}
						}
						await hide((item) => item.body_color_id === colorId && item.panel_color_id !== panel.id);
						if (!drafts.length && group.colorId) continue;
						const start = group.photos.filter((photo) => photo.mediaId).length;
						for (let index = 0; index < drafts.length; index += 1) {
								const photo = drafts[index];
								await uploadProductMedia(product.id, photoData(photo.file, name, colorId, start + index === 0, start + index));
								dropped.current.add(photo.key);
								if (photo.preview?.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
						}
						if (!group.colorId) dropped.current.add(group.key);
				}
				};
		});

		async function run(task) {
				setError(null);
				setPending(true);
				try {
						await task();
						await refreshCatalog(client, product);
				} catch (err) {
						setError(err);
				} finally {
						setPending(false);
				}
		}

		async function panelForColor(colorId) {
				const group = shots.find((item) => item.colorId === colorId);
				const name = group?.panelName?.trim();
				if (!name) throw new Error("Укажите цвет панели у каждого цвета корпуса.");
				return ensureOption("panel-colors", options.panel_color, name);
		}

		async function place({size, colorId, controlId, panelId}) {
				const existing = rows.find((row) => (
						row.width_mm === size.width
						&& row.height_mm === size.height
						&& row.body_color_id === colorId
						&& row.control_type_id === controlId
						&& row.panel_color_id === panelId
				));
				const priceMinor = priceToMinor(price);
				if (existing) {
						if (existing.is_active === false) {
								await updateVariant(existing.id, {is_active: true, price_minor: priceMinor, expected_updated_at: existing.updated_at});
						}
						return existing;
				}
				const body = options.body_color.find((item) => item.id === colorId);
				const control = options.control_type.find((item) => item.id === controlId);
				const panel = options.panel_color.find((item) => item.id === panelId);
				return createVariant({
						product_id: product.id,
						sku: ["EN", slugify(product.model_code), `${size.height}X${size.width}`, slugify(body?.slug || body?.name || colorId), slugify(control?.slug || control?.name || controlId), slugify(panel?.slug || panel?.name || panelId)].join("-").toUpperCase().slice(0, 120),
						width_mm: size.width,
						height_mm: size.height,
						body_color_id: colorId,
						control_type_id: controlId,
						panel_color_id: panelId,
						price_minor: priceMinor,
						currency: "RUB",
						availability_status: "in_stock",
						is_active: true,
				});
		}

		async function hide(predicate) {
				for (const row of shown.filter(predicate)) {
						await updateVariant(row.id, {is_active: false, expected_updated_at: row.updated_at});
				}
		}

		async function addVariantSize() {
				await run(async () => {
						const size = {width: integer(width, "Ширина", 1), height: integer(height, "Высота", 1)};
						for (const color of colors) {
								const panel = await panelForColor(color.body_color_id);
								for (const control of controls) {
										await place({
												size,
												colorId: color.body_color_id,
												controlId: control.control_type_id,
												panelId: panel.id,
										});
								}
						}
						setWidth("");
						setHeight("");
				});
		}

		async function addVariantControl() {
				await run(async () => {
						const name = controlName.trim();
						if (!name) throw new Error("Введите название управления.");
						const control = await ensureOption("control-types", options.control_type, name);
						for (const size of sizes) {
								for (const color of colors) {
										const panel = await panelForColor(color.body_color_id);
										await place({
												size: {width: size.width_mm, height: size.height_mm},
												colorId: color.body_color_id,
												controlId: control.id,
												panelId: panel.id,
										});
								}
						}
						setControlName("");
				});
		}

		async function persistOrder(group, photos) {
				setShots((current) => current.map((item) => item.key === group.key ? {...item, photos} : item));
				await run(async () => {
						const patched = new Map();
						for (let index = 0; index < photos.length; index += 1) {
								const photo = photos[index];
								if (!photo.mediaId || photo.sortOrder === index) continue;
								const updated = await updateProductMedia(photo.mediaId, {
										sort_order: index,
										expected_updated_at: photo.updatedAt,
								});
								patched.set(photo.mediaId, updated.updated_at);
						}
						setShots((current) => current.map((item) => item.key === group.key ? {
								...item,
								photos: photos.map((photo, index) => (
										patched.has(photo.mediaId) ? {...photo, sortOrder: index, updatedAt: patched.get(photo.mediaId)} : photo
								)),
						} : item));
				});
		}

		async function addSavedPhotos(group, photos) {
				await run(async () => {
						const start = group.photos.filter((photo) => photo.mediaId).length;
						for (let index = 0; index < photos.length; index += 1) {
								const photo = photos[index];
								await uploadProductMedia(product.id, photoData(photo.file, group.name, group.colorId, start + index === 0, start + index));
								if (photo.preview?.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
						}
				});
		}

		return (
				<div className={p.sale}>
						<div className={p.saleGroup}>
								<div className={p.sectionIntro}><h4>Цена</h4><p>Цена общая для всех комплектаций товара.</p></div>
								<div className={p.line}>
									<Input compact className={p.narrow} label="Цена, ₽" inputMode="decimal" required value={price} onChange={(event) => setPrice(event.target.value)} />
								</div>
						</div>
						<div className={p.saleGroup}>
								<div className={p.sectionIntro}><h4>Размеры</h4><p>Управляйте доступными размерами модели.</p></div>
								<div className={p.chips}>
										{sizes.map((row) => (
												<Chip
														key={`${row.width_mm}x${row.height_mm}`}
														label="Убрать размер"
														onRemove={sizes.length > 1 && !pending ? () => run(() => hide((item) => item.width_mm === row.width_mm && item.height_mm === row.height_mm)) : undefined}
												>
														{row.width_mm} × {row.height_mm}
												</Chip>
										))}
								</div>
								<div className={p.line}>
										<Input compact className={p.narrow} label="Ширина" type="number" min={1} max={MAX_INTEGER} value={width} onChange={(event) => setWidth(event.target.value)} />
										<Input compact className={p.narrow} label="Высота" type="number" min={1} max={MAX_INTEGER} value={height} onChange={(event) => setHeight(event.target.value)} />
										<Button type="button" size="compact" variant="ginger" disabled={pending} onClick={addVariantSize}>
												<Plus size={13} /> Добавить размер
										</Button>
								</div>
						</div>
						<div className={p.saleGroup}>
								<div className={p.sectionIntro}><h4>Управление</h4><p>Тип управления используется во всех размерах и цветах.</p></div>
								<div className={p.chips}>
										{controls.map((row) => (
												<Chip
														key={row.control_type_id}
														label="Убрать управление"
														onRemove={controls.length > 1 && !pending ? () => run(() => hide((item) => item.control_type_id === row.control_type_id)) : undefined}
												>
														{labelOf(options.control_type, row.control_type_id)}
												</Chip>
										))}
								</div>
								<div className={p.line}>
										<Input compact className={p.narrow} label="Своё" maxLength={120} value={controlName} onChange={(event) => setControlName(event.target.value)} />
										<Button type="button" size="compact" variant="ginger" disabled={pending} onClick={addVariantControl}>
												<Plus size={13} /> Добавить
										</Button>
								</div>
						</div>
						<div className={p.saleGroup}>
								<div className={p.sectionIntro}><h4>Цвет корпуса и панели</h4><p>У каждого цвета корпуса своя панель и галерея фотографий.</p></div>
								<ColorGallery
										groups={shots}
										onChange={setShots}
										onAddPhotos={addSavedPhotos}
										onReorderPhotos={persistOrder}
										onDeletePhoto={(group, photo) => run(async () => {
												await deleteProductMedia(photo.mediaId);
												setShots((current) => current.map((item) => item.key === group.key ? {
														...item,
														photos: item.photos.filter((entry) => entry.key !== photo.key),
												} : item));
										})}
										onDeleteGroup={(group) => run(async () => {
											if (group.colorId) await hide((item) => item.body_color_id === group.colorId);
											for (const photo of group.photos) {
													if (photo.mediaId) await deleteProductMedia(photo.mediaId);
													if (photo.preview?.startsWith("blob:")) URL.revokeObjectURL(photo.preview);
												}
											setShots((current) => current.filter((item) => item.key !== group.key));
										})}
										onError={setError}
										uploading={uploading}
								/>
						</div>
						<FormError error={error} />
				</div>
		);
}

function ProductForm({product, onCreated, onReload}) {
		const client = useQueryClient();
		const variantsQuery = useAdminVariants(product?.id);
		const mediaQuery = useProductMedia(product?.id);
		const catalog = useCatalogOptions();
		const rows = variantsQuery.data ?? EMPTY_ROWS;
		const [draft, setDraft] = useState(() => productDraft(product));
		const [error, setError] = useState(null);
		const [reloading, setReloading] = useState(false);
		const [pending, setPending] = useState(false);
		const [sizes, setSizes] = useState([]);
		const [bodies, setBodies] = useState(() => [{key: crypto.randomUUID(), name: "", hex: "#20201F", panelName: "", photos: []}]);
		const [controls, setControls] = useState(["Электронное"]);
		const [priceOverride, setPriceOverride] = useState(null);
		const initialPrice = product ? activeRows(rows)[0]?.price_minor : undefined;
		const price = priceOverride ?? (initialPrice == null ? "" : minorToPrice(initialPrice));
		const setPrice = setPriceOverride;
		const commitRef = useRef(null);
		const productId = product?.id;
		const save = useCatalogMutation((body) => updateProduct(productId, body), {kind: "product", product});
		const archived = Boolean(product?.archived_at);
		function field(name) {
				return {
						value: draft[name],
						onChange: (event) => setDraft((previous) => ({...previous, [name]: event.target.value})),
				};
		}

		async function submit(event) {
				event.preventDefault();
				setError(null);
				const publish = event.nativeEvent.submitter?.value === "publish";
				if (product) {
						setPending(true);
						try {
								const nextPrice = priceToMinor(price);
								const body = productPayload(draft);
								delete body.is_published;
								body.expected_updated_at = product.updated_at;
								await save.mutateAsync(body);
								if (commitRef.current) await commitRef.current();
								for (const row of activeRows(rows)) {
										if (row.price_minor === nextPrice) continue;
										await updateVariant(row.id, {price_minor: nextPrice, expected_updated_at: row.updated_at});
								}
								await refreshCatalog(client, product);
								toast.success("Товар сохранён");
						} catch (err) {
								setError(err);
						} finally {
							setPending(false);
						}
						return;
				}

				setPending(true);
				try {
						const card = productPayload(draft);
						card.is_published = publish;
						if (!sizes.length || !bodies.length || !controls.length) {
								throw new Error("Добавьте цвет корпуса, размер и управление.");
						}
						if (bodies.some((item) => !item.name.trim())) throw new Error("Укажите название у каждого цвета.");
						if (bodies.some((item) => !item.panelName?.trim())) throw new Error("Укажите цвет панели для каждого цвета корпуса.");
						const planned = buildOffer({
								modelCode: card.model_code,
								sizes,
								bodies,
								controls,
								priceMinor: priceToMinor(price),
						});
						const created = await createProduct({
								...card,
								variants: planned.map((item) => ({
										sku: item.sku,
										width_mm: item.width_mm,
										height_mm: item.height_mm,
										body_color: item.body_color,
										panel_color: item.panel_color,
										control_type: item.control_type,
										price_minor: item.price_minor,
										currency: item.currency,
										availability_status: item.availability_status,
										is_active: item.is_active,
								})),
						});
						const bySku = new Map((created.variants ?? []).map((item) => [item.sku, item]));
						try {
								for (const body of bodies) {
										const sample = planned.find((item) => item.colorKey === body.key);
										const saved = bySku.get(sample?.sku);
										if (!saved?.body_color_id) continue;
										for (let index = 0; index < body.photos.length; index += 1) {
												const photo = body.photos[index];
												if (!photo.file) continue;
												await uploadProductMedia(created.id, photoData(photo.file, body.name, saved.body_color_id, index === 0, index));
										}
								}
						} catch (err) {
								toast.error(err.message || "Фото не загрузилось");
						}
						await client.invalidateQueries({queryKey: ["admin", "catalog"]});
						await client.invalidateQueries({queryKey: queryKeys.products});
						toast.success(publish ? "Товар на сайте" : "Товар сохранён");
						onCreated(created.id);
				} catch (err) {
						setError(err);
				} finally {
						setPending(false);
				}
		}

		async function reload() {
				setReloading(true);
				try {
						const result = await onReload();
						if (result.error) throw result.error;
						setDraft(productDraft(result.data));
						setError(null);
				} catch (err) {
						setError(err);
				} finally {
						setReloading(false);
				}
		}

		const loadingShelf = Boolean(product) && (variantsQuery.isLoading || mediaQuery.isLoading || catalog.isPending);

		return (
				<form className={s.stack} onSubmit={submit}>
						<fieldset disabled={pending || save.isPending || archived || reloading} className={s.stack}>
								<ProductFields field={field} onCategory={(category) => setDraft((previous) => ({...previous, category}))} />
								<section className={s.card}>
										<div className={p.sectionIntro}>
											<Title level={3}>Комплектация</Title>
											<p>Настройте общие параметры — они применятся ко всем сочетаниям вариантов.</p>
										</div>
										{product ? (
												<>
														{loadingShelf ? (
																<RequestState pending />
														) : variantsQuery.error || mediaQuery.error ? (
																<RequestState pending={false} error={variantsQuery.error ?? mediaQuery.error} onRetry={() => { variantsQuery.refetch(); mediaQuery.refetch(); }} isFetching={variantsQuery.isFetching || mediaQuery.isFetching} />
														) : (
										<LiveSale product={product} rows={rows} media={mediaQuery.data ?? EMPTY_MEDIA} options={catalog.options} price={price} setPrice={setPrice} commitRef={commitRef} uploading={pending} />
														)}
												</>
										) : (
												<NewSale
														sizes={sizes}
														setSizes={setSizes}
														bodies={bodies}
														setBodies={setBodies}
														controls={controls}
														setControls={setControls}
														price={price}
														setPrice={setPrice}
																uploading={pending}
												/>
										)}
								</section>
						</fieldset>
						<FormError error={error} />
						{error?.code === "concurrent_update" && (
								<div className={s.notice}>
										<p>Данные на сервере новее. Загрузите их и сохраните ещё раз.</p>
										<Button type="button" size="compact" variant="soft" isLoading={reloading} onClick={reload}>Загрузить заново</Button>
								</div>
						)}
						{!archived && (
								<div className={`${s.formFooter} ${p.saveBar}`}>
										<Button type="submit" name="intent" value="save" size="compact" variant="ginger" isLoading={pending || save.isPending} disabled={reloading}>
												<Save size={15} /> Сохранить
										</Button>
										{!product && (
												<Button type="submit" name="intent" value="publish" size="compact" variant="ginger" isLoading={pending} disabled={reloading}>
														Показать на сайте
												</Button>
										)}
								</div>
						)}
				</form>
		);
}

function ProductActions({product}) {
		const navigate = useNavigate();
		const [confirmArchive, setConfirmArchive] = useState(false);
		const archive = useCatalogMutation(({id, updated_at}) => archiveProduct(id, updated_at), {kind: "product", product});
		const productId = product.id;
		const updatedAt = product.updated_at;
		const published = product.is_published;
		const publish = useCatalogMutation(
				(isPublished) => updateProduct(productId, {is_published: isPublished, expected_updated_at: updatedAt}),
				{kind: "product", product},
		);

		if (product.archived_at) return <p className={s.muted}>Товар в архиве и не показывается на сайте.</p>;

		return (
				<>
						<div className={s.actions}>
								<Button
										size="compact"
										variant={published ? "soft" : "ginger"}
										isLoading={publish.isPending}
										onClick={() => publish.mutate(!published, {
												onSuccess: () => toast.success(published ? "Товар скрыт с сайта" : "Товар на сайте"),
												onError: (err) => toast.error(err.message),
										})}
								>
										{published ? "Скрыть с сайта" : "Показать на сайте"}
								</Button>
								<Button size="compact" variant="soft" className={s.danger} onClick={() => { archive.reset(); setConfirmArchive(true); }}>
										<Archive size={15} /> В архив
								</Button>
						</div>
						{confirmArchive && (
								<ConfirmDialog
										title="Убрать товар в архив?"
										confirmLabel="В архив"
										pending={archive.isPending}
										error={archive.error}
										onClose={() => setConfirmArchive(false)}
										onConfirm={() => archive.mutate(product, {
												onSuccess: () => {
														toast.success("Товар в архиве");
														navigate("/admin/products");
												},
										})}
								>
										«{product.name}» пропадёт с сайта навсегда. Чтобы просто скрыть его, нажмите «Скрыть с сайта».
								</ConfirmDialog>
						)}
				</>
		);
}

export function ProductEditorPage() {
		const {productId} = useParams();
		const navigate = useNavigate();
		const query = useAdminProduct(productId);
		const product = query.data;

		if (productId && (query.isPending || query.error)) {
				return (
						<div className={s.page}>
								<Link to="/admin/products" className={s.back}><ArrowLeft size={15} /> К товарам</Link>
								<RequestState pending={query.isPending} error={query.error} onRetry={query.refetch} isFetching={query.isFetching} />
						</div>
				);
		}

		return (
				<div className={s.page}>
						<Link to="/admin/products" className={s.back}><ArrowLeft size={15} /> К товарам</Link>
						<header className={s.header}>
								<div>
										<Title level={1}>{product ? product.name : "Новый товар"}</Title>
										{product && <p className={s.muted}>Модель {product.model_code}</p>}
								</div>
								{product && <ProductActions product={product} />}
						</header>
								<ProductForm
								key={product?.id ?? "new"}
										product={product}
								onCreated={(id) => navigate(`/admin/products/${id}`, {replace: true})}
										onReload={query.refetch}
								/>
				</div>
		);
}
