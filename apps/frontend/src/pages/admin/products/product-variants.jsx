import {useState} from "react";
import {Plus, Pencil} from "lucide-react";
import {toast} from "sonner";
import {createCatalogOption, createVariant, updateVariant} from "../../../api/admin/catalog";
import {useAdminVariants, useCatalogMutation, useCatalogOptions} from "../../../hooks/queries/use-admin-catalog";
import {Badge} from "../../../components/ui/badge/badge";
import {Button} from "../../../components/ui/button/button";
import {Input} from "../../../components/ui/input/input";
import {Select} from "../../../components/ui/select/select";
import {Textarea} from "../../../components/ui/textarea/textarea";
import {Title} from "../../../components/ui/typography/title/title";
import {Spinner} from "../../../components/ui/spinner/spinner";
import {formatPriceMinor} from "../../../utils/format";
import {AdminDialog, EmptyState, FormError, RequestState} from "../admin-ui";
import {AVAILABILITY_LABELS, integer, MAX_INTEGER, minorToPrice, priceToMinor} from "./product-form";
import s from "../admin.module.css";
import p from "./products.module.css";

const OPTION_TYPES = [
		{type: "body_color", resource: "body-colors", label: "Цвет корпуса"},
		{type: "panel_color", resource: "panel-colors", label: "Цвет панели"},
		{type: "control_type", resource: "control-types", label: "Тип управления"},
];

function OptionForm({option, onClose, onCreated}) {
		const [draft, setDraft] = useState({
				name: "",
				slug: "",
				hex_value: "#282824",
				description: "",
		});
		const [error, setError] = useState(null);
		const save = useCatalogMutation((body) => createCatalogOption(option.resource, body), {
				kind: "option",
				optionType: option.type,
		});

		async function submit(event) {
				event.preventDefault();
				setError(null);
				try {
						const body = {name: draft.name.trim(), slug: draft.slug.trim()};
						if (!body.name || !body.slug) throw new Error("Заполните название и slug.");
						if (option.type === "body_color") body.hex_value = draft.hex_value;
						if (option.type === "control_type") body.description = draft.description.trim();

						const result = await save.mutateAsync(body);
						onCreated(result);

						toast.success("Значение добавлено в справочник");
				} catch (err) {
						setError(err);
				}
		}

		return (
				<AdminDialog title={`Добавить: ${option.label.toLowerCase()}`} onClose={onClose} busy={save.isPending}>
						<form className={s.stack} onSubmit={submit}>
								<fieldset className={s.stack} disabled={save.isPending}>
										<Input
												compact
												label="Название"
												required
												maxLength={120}
												value={draft.name}
												onChange={(event) => setDraft({...draft, name: event.target.value})}
										/>
										<Input
												compact
												label="Уникальный slug"
												required
												maxLength={80}
												placeholder="Например, graphite"
												value={draft.slug}
												onChange={(event) => setDraft({...draft, slug: event.target.value})}
										/>
										{option.type === "body_color" && (
												<div className={s.grid}>
														<Input
																compact
																label="Цвет"
																type="color"
																value={draft.hex_value}
																onChange={(event) => setDraft({...draft, hex_value: event.target.value})}
														/>
														<Input
																compact
																label="HEX цвета"
																pattern="#[0-9a-fA-F]{6}"
																required
																maxLength={7}
																value={draft.hex_value}
																onChange={(event) => setDraft({...draft, hex_value: event.target.value})}
														/>
												</div>
										)}
										{option.type === "control_type" && (
												<Textarea
														compact
														label="Описание управления"
														value={draft.description}
														onChange={(event) => setDraft({...draft, description: event.target.value})}
												/>
										)}
								</fieldset>
								<p className={s.hint}>Название и slug должны быть уникальными.</p>
								<FormError error={error}/>
								<div className={s.formFooter}>
										<Button size="compact" variant="soft" disabled={save.isPending} onClick={onClose}>
												Отмена
										</Button>
										<Button type="submit" size="compact" variant="ginger" isLoading={save.isPending}>
												Добавить значение
										</Button>
								</div>
						</form>
				</AdminDialog>
		);
}

function ReferenceField({option, values, value, onChange, onAdd}) {
		const choices = values.filter((item) => item.is_active !== false);

		return (
				<div className={p.referenceField}>
						<Select
								compact
								label={option.label}
								value={value}
								required
								onChange={(event) => onChange(event.target.value)}
						>
								<option value="">Выберите значение</option>
								{choices.map((item) => (
										<option key={item.id} value={item.id}>
												{item.name}
										</option>
								))}
						</Select>
						<Button size="compact" variant="soft" onClick={onAdd}>
								<Plus size={13}/> Добавить значение
						</Button>
				</div>
		);
}

function VariantForm({product, options, onSaved, onCancel}) {
		const [draft, setDraft] = useState({
				sku: "",
				width_mm: "",
				height_mm: "",
				body_color_id: "",
				panel_color_id: "",
				control_type_id: "",
				price: "",
				currency: "RUB",
				availability_status: "in_stock",
				is_active: true,
		});
		const [creatingOption, setCreatingOption] = useState(null);
		const [error, setError] = useState(null);
		const save = useCatalogMutation(createVariant, {kind: "variant", product});

		const field = (name) => ({
				value: draft[name],
				onChange: (event) => setDraft((previous) => ({...previous, [name]: event.target.value})),
		});

		async function submit(event) {
				event.preventDefault();
				setError(null);
				try {
						if (!draft.sku.trim()) throw new Error("Укажите артикул комплектации.");
						const result = await save.mutateAsync({
								product_id: product.id,
								sku: draft.sku.trim(),
								width_mm: integer(draft.width_mm, "Ширина", 1),
								height_mm: integer(draft.height_mm, "Высота", 1),
								body_color_id: draft.body_color_id.trim(),
								panel_color_id: draft.panel_color_id.trim(),
								control_type_id: draft.control_type_id.trim(),
								price_minor: priceToMinor(draft.price),
								currency: draft.currency.trim().toUpperCase(),
								availability_status: draft.availability_status,
								is_active: draft.is_active,
						});
						onSaved(result);
						toast.success("Комплектация создана");
				} catch (err) {
						setError(err);
				}
		}

		return (
				<>
						<form className={s.card} onSubmit={submit}>
								<Title level={3}>Новая комплектация</Title>
								<fieldset className={s.stack} disabled={save.isPending}>
										<div className={s.grid}>
												<Input
														compact
														label="Артикул (SKU)"
														required
														maxLength={120}
														placeholder="EN-600-GR-WIFI"
														{...field("sku")}
												/>
												<Select compact label="Наличие" {...field("availability_status")}>
														{Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
																<option key={value} value={value}>
																		{label}
																</option>
														))}
												</Select>
												<Input
														compact
														label="Ширина, мм"
														type="number"
														min={1}
														max={MAX_INTEGER}
														step={1}
														required
														{...field("width_mm")}
												/>
												<Input
														compact
														label="Высота, мм"
														type="number"
														min={1}
														max={MAX_INTEGER}
														step={1}
														required
														{...field("height_mm")}
												/>
												{OPTION_TYPES.map((option) => (
														<ReferenceField
																key={option.type}
																option={option}
																values={options[option.type]}
																value={draft[`${option.type}_id`]}
																onChange={(value) =>
																		setDraft((previous) => ({
																				...previous,
																				[`${option.type}_id`]: value,
																		}))
																}
																onAdd={() => setCreatingOption(option)}
														/>
												))}
												<Input
														compact
														label={`Цена, ${draft.currency.toUpperCase() || "RUB"}`}
														inputMode="decimal"
														required
														placeholder="12600,00"
														{...field("price")}
												/>
												<Input compact label="Валюта (код)" required pattern="[A-Za-z]{3}"
															 maxLength={3} {...field("currency")} />
										</div>
										<label className={s.checkbox}>
												<input
														type="checkbox"
														checked={draft.is_active}
														onChange={(event) =>
																setDraft({
																		...draft,
																		is_active: event.target.checked,
																})
														}
												/>{" "}
												Активная комплектация
										</label>
								</fieldset>
								<p className={s.hint}>Артикул и сочетание размера, цветов и управления должны быть уникальными.</p>
								<FormError error={error}/>
								<div className={s.formFooter}>
										<Button size="compact" variant="soft" disabled={save.isPending} onClick={onCancel}>
												Отмена
										</Button>
										<Button type="submit" size="compact" variant="ginger" isLoading={save.isPending}>
												Создать комплектацию
										</Button>
								</div>
						</form>
						{creatingOption && (
								<OptionForm
										option={creatingOption}
										onClose={() => setCreatingOption(null)}
										onCreated={(value) => {
												setDraft((previous) => ({...previous, [`${creatingOption.type}_id`]: value.id}));
												setCreatingOption(null);
										}}
								/>
						)}
				</>
		);
}

function VariantEditor({product, variant, onSaved, onClose}) {
		const [draft, setDraft] = useState({
				price: minorToPrice(variant.price_minor),
				availability_status: variant.availability_status,
				is_active: variant.is_active,
		});
		const [error, setError] = useState(null);
		const save = useCatalogMutation((body) => updateVariant(variant.id, body), {
				kind: "variant",
				product,
		});

		async function submit(event) {
				event.preventDefault();
				setError(null);
				try {
						const result = await save.mutateAsync({
								price_minor: priceToMinor(draft.price),
								availability_status: draft.availability_status,
								is_active: draft.is_active,
								expected_updated_at: variant.updated_at,
						});
						onSaved(result);
						toast.success("Комплектация обновлена");
				} catch (err) {
						setError(err);
				}
		}

		return (
				<AdminDialog title={`Комплектация ${variant.sku}`} onClose={onClose} busy={save.isPending}>
						<form className={s.stack} onSubmit={submit}>
								<fieldset className={s.stack} disabled={save.isPending}>
										<Input
												compact
												label={`Цена, ${variant.currency}`}
												inputMode="decimal"
												required
												value={draft.price}
												onChange={(event) => setDraft({...draft, price: event.target.value})}
										/>
										<Select
												compact
												label="Наличие"
												value={draft.availability_status}
												onChange={(event) =>
														setDraft({
																...draft,
																availability_status: event.target.value,
														})
												}
										>
												{Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
														<option key={value} value={value}>
																{label}
														</option>
												))}
										</Select>
										<label className={s.checkbox}>
												<input
														type="checkbox"
														checked={draft.is_active}
														onChange={(event) =>
																setDraft({
																		...draft,
																		is_active: event.target.checked,
																})
														}
												/>{" "}
												Активная комплектация
										</label>
								</fieldset>
								<FormError
										error={
												error?.code === "concurrent_update"
														? {message: "Комплектацию изменил другой сотрудник. Ваши изменения не сохранены."}
														: error
										}
								/>
								<div className={s.formFooter}>
										<Button size="compact" variant="soft" disabled={save.isPending} onClick={onClose}>
												Закрыть
										</Button>
										<Button
												type="submit"
												size="compact"
												variant="ginger"
												isLoading={save.isPending}
										>
												Сохранить комплектацию
										</Button>
								</div>
						</form>
				</AdminDialog>
		);
}

export function ProductVariants({product}) {
		const catalog = useCatalogOptions();
		const variantsQuery = useAdminVariants(product.id);
		const variants = variantsQuery.data ?? [];
		const [creating, setCreating] = useState(false);
		const [editingId, setEditingId] = useState(null);
		const editing = variants.find((variant) => variant.id === editingId) ?? null;

		function saveRecord() {
				setCreating(false);
				setEditingId(null);
		}

		return (
				<div className={s.stack}>
						<div className={s.sectionHeader}>
								<Title level={3}>Комплектации товара</Title>
								{!product.archived_at && !creating && (
										<Button size="compact" variant="ginger" onClick={() => setCreating(true)}>
												<Plus size={15}/> Добавить комплектацию
										</Button>
								)}
						</div>

						{creating && (
								<>
										{catalog.isPending && (
												<div className={s.actions} role="status">
														<Spinner size={16}/>
														<span className={s.hint}>Загрузка цветов и типов управления...</span>
												</div>
										)}
										{catalog.error &&
												<p className={s.error} role="alert">Не удалось загрузить цвета и типы управления.</p>}
										<VariantForm
												product={product}
												options={catalog.options}
												onSaved={saveRecord}
												onCancel={() => setCreating(false)}
										/>
								</>
						)}

						<RequestState
								pending={variantsQuery.isPending}
								error={variantsQuery.error}
								onRetry={variantsQuery.refetch}
								isFetching={variantsQuery.isFetching}
						/>

						{variants.length ? (
								<div className={s.tableWrap}>
										<table className={s.table}>
												<thead>
												<tr>
														<th scope="col">Артикул / размер</th>
														<th scope="col">Цвета и управление</th>
														<th scope="col">Цена</th>
														<th scope="col">Наличие</th>
														<th scope="col">Действия</th>
												</tr>
												</thead>
												<tbody>
												{variants.map((variant) => {
														const bodyColor =
																variant.body_color ?? catalog.options.body_color.find((item) => item.id === variant.body_color_id);
														const panelColor =
																variant.panel_color ?? catalog.options.panel_color.find((item) => item.id === variant.panel_color_id);
														const control =
																variant.control_type ?? catalog.options.control_type.find((item) => item.id === variant.control_type_id);

														return (
																<tr key={variant.id}>
																		<td>
																				<span className={s.name}>{variant.sku}</span>
																				<span className={s.subline}>
                        {variant.width_mm} × {variant.height_mm} мм
                      </span>
																		</td>
																		<td>
																				<div className={p.variantSummary}>
																						{bodyColor?.hex_value && (
																								<span className={s.swatch} style={{background: bodyColor.hex_value}}/>
																						)}
																						<span>
                          {bodyColor?.name ?? variant.body_color_id}
																								<span
																										className={s.subline}>Панель: {panelColor?.name ?? variant.panel_color_id}</span>
                          <span className={s.subline}>{control?.name ?? variant.control_type_id}</span>
                        </span>
																				</div>
																		</td>
																		<td className={s.nowrap}>{formatPriceMinor(variant.price_minor, variant.currency)}</td>
																		<td>
																				<Badge
																						variant={
																								variant.is_active === false || variant.availability_status === "hidden"
																										? "out_of_stock"
																										: variant.availability_status
																						}
																				>
																						{variant.is_active === false
																								? "Неактивна"
																								: AVAILABILITY_LABELS[variant.availability_status]}
																				</Badge>
																		</td>
																		<td>
																				{variant.updated_at && !product.archived_at ? (
																						<Button size="compact" variant="soft" onClick={() => setEditingId(variant.id)}>
																								<Pencil size={14}/> Изменить
																						</Button>
																				) : (
																						<span className={s.hint}>Только просмотр</span>
																				)}
																		</td>
																</tr>
														);
												})}
												</tbody>
										</table>
								</div>
						) : (
								!variantsQuery.isPending && !variantsQuery.error && (
										<EmptyState>
												<p>Нет доступных комплектаций.</p>
										</EmptyState>
								)
						)}

						{editing && (
								<VariantEditor
										product={product}
										variant={editing}
										onSaved={saveRecord}
										onClose={() => setEditingId(null)}
								/>
						)}
				</div>
		);
}