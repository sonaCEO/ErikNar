import {useEffect, useRef, useState} from "react";
import {ImagePlus, Pencil, Star, Trash2} from "lucide-react";
import {toast} from "sonner";
import {deleteProductMedia, updateProductMedia, uploadProductMedia} from "../../../api/admin/catalog";
import {useAdminVariants, useCatalogMutation, useCatalogOptions, useProductMedia} from "../../../hooks/queries/use-admin-catalog";
import {Button} from "../../../components/ui/button/button";
import {Input} from "../../../components/ui/input/input";
import {Select} from "../../../components/ui/select/select";
import {Title} from "../../../components/ui/typography/title/title";
import {AdminDialog, ConfirmDialog, EmptyState, FormError, RequestState} from "../admin-ui";
import {
		MAX_ORDER_POSITION,
		orderToPosition,
		positionToOrder,
		sameMediaScope,
		validateImage,
} from "./product-form";
import s from "../admin.module.css";
import p from "./products.module.css";

function MediaEditor({media, onClose, mutation}) {
		const [draft, setDraft] = useState({
				alt_text: media.alt_text,
				sort_order: orderToPosition(media.sort_order),
				is_primary: media.is_primary,
		});
		const [error, setError] = useState(null);

		async function submit(event) {
				event.preventDefault();
				setError(null);
				try {
						await mutation.mutateAsync({
								media,
								values: {...draft, sort_order: positionToOrder(draft.sort_order)},
						});
						toast.success("Фотография обновлена");
						onClose();
				} catch (err) {
						setError(err);
				}
		}

		return (
				<AdminDialog title="Настройки фотографии" onClose={onClose} busy={mutation.isPending}>
						<form className={s.stack} onSubmit={submit}>
								<fieldset className={s.stack} disabled={mutation.isPending}>
										<Input
												compact
												label="Описание фотографии"
												maxLength={300}
												value={draft.alt_text}
												onChange={(event) => setDraft({...draft, alt_text: event.target.value})}
										/>
										<Input
												compact
												label="Порядок фото"
												type="number"
												min={1}
												max={MAX_ORDER_POSITION}
												step={1}
												required
												value={draft.sort_order}
												onChange={(event) => setDraft({...draft, sort_order: event.target.value})}
										/>
										<label className={s.checkbox}>
												<input
														type="checkbox"
														checked={draft.is_primary}
														onChange={(event) =>
																setDraft({
																		...draft,
																		is_primary: event.target.checked,
																})
														}
												/>{" "}
												Основное фото для этой привязки
										</label>
								</fieldset>
								<FormError error={error}/>
								{error?.code === "concurrent_update" && (
										<p className={s.hint}>Список фотографий обновлён. Закройте окно и откройте фотографию повторно.</p>
								)}
								<div className={s.formFooter}>
										<Button size="compact" variant="soft" onClick={onClose} disabled={mutation.isPending}>
												Отмена
										</Button>
										<Button type="submit" size="compact" variant="ginger" isLoading={mutation.isPending}>
												Сохранить фото
										</Button>
								</div>
						</form>
				</AdminDialog>
		);
}

function variantLabel(variant) {
		return `${variant.sku} · ${variant.width_mm} × ${variant.height_mm} мм`;
}

function mediaScopeLabel(item, variants, colors) {
		if (item.variant_id) {
				const variant = variants.find((entry) => entry.id === item.variant_id);
				return variant ? `Комплектация: ${variantLabel(variant)}` : "Комплектация";
		}
		if (item.body_color_id) {
				const color = colors.find((entry) => entry.id === item.body_color_id);
				return color ? `Цвет: ${color.name}` : "Цвет корпуса";
		}
		return "Общее фото товара";
}

export function ProductMedia({product}) {
		const query = useProductMedia(product.id);
		const variantsQuery = useAdminVariants(product.id);
		const catalog = useCatalogOptions();
		const media = query.data ?? [];
		const variants = variantsQuery.data ?? [];
		const colors = catalog.options.body_color.filter((color) => color.is_active !== false);
		const [file, setFile] = useState(null);
		const [preview, setPreview] = useState("");
		const [draft, setDraft] = useState({alt_text: "", sort_order: 1, variant_id: "", body_color_id: ""});
		const [primary, setPrimary] = useState(null);
		const [error, setError] = useState(null);
		const [editing, setEditing] = useState(null);
		const [deleting, setDeleting] = useState(null);
		const fileInput = useRef(null);
		const upload = useCatalogMutation((body) => uploadProductMedia(product.id, body), {kind: "media", product});
		const remove = useCatalogMutation((id) => deleteProductMedia(id), {kind: "media", product});
		const update = useCatalogMutation(
				async ({media: target, values}) => {
						const previous =
								values.is_primary &&
								media.find((item) => item.id !== target.id && item.is_primary && sameMediaScope(item, target));
						let demoted;

						if (previous)
								demoted = await updateProductMedia(previous.id, {
										is_primary: false,
										expected_updated_at: previous.updated_at,
								});
						try {
								return await updateProductMedia(target.id, {...values, expected_updated_at: target.updated_at});
						} catch (err) {
								if (demoted) {
										try {
												await updateProductMedia(previous.id, {
														is_primary: true,
														expected_updated_at: demoted.updated_at
												});
										} catch {
												toast.error("Не удалось восстановить основное фото. Проверьте обновлённый список фотографий.");
										}
								}
								throw err;
						}
				},
				{kind: "media", product}
		);
		const busy = upload.isPending || remove.isPending || update.isPending;

		useEffect(
				() => () => {
						if (preview) URL.revokeObjectURL(preview);
				},
				[preview]
		);

		function chooseFile(event) {
				const selected = event.target.files?.[0];
				setError(null);
				setFile(null);
				setPreview("");
				if (!selected) return;
				try {
						validateImage(selected);
						setFile(selected);
						setPreview(URL.createObjectURL(selected));
				} catch (err) {
						setError(err);
				}
		}

		async function submit(event) {
				event.preventDefault();
				setError(null);
				try {
						validateImage(file);
						const body = new FormData();
						body.append("file", file);
						body.append("alt_text", draft.alt_text.trim());
						body.append("sort_order", String(positionToOrder(draft.sort_order)));
						body.append("is_primary", String(primary ?? media.length === 0));
						if (draft.variant_id) body.append("variant_id", draft.variant_id);
						else if (draft.body_color_id) body.append("body_color_id", draft.body_color_id);
						await upload.mutateAsync(body);
						setFile(null);
						setPreview("");
						if (fileInput.current) fileInput.current.value = "";
						setDraft({...draft, alt_text: "", sort_order: Math.min(MAX_ORDER_POSITION, Number(draft.sort_order) + 1)});
						setPrimary(false);
						toast.success("Фотография загружена");
				} catch (err) {
						setError(err);
				}
		}

		return (
				<div className={s.stack}>
						{!product.archived_at && (
								<form className={s.card} onSubmit={submit}>
										<Title level={3}>Добавить фотографию</Title>
										<fieldset className={s.stack} disabled={busy || query.isPending || Boolean(query.error)}>
												<div className={s.grid}>
														<Input
																compact
																ref={fileInput}
																label="Файл изображения"
																type="file"
																accept="image/jpeg,image/png,image/webp"
																required
																onChange={chooseFile}
														/>
														<Input
																compact
																label="Описание фотографии"
																maxLength={300}
																placeholder="Например, вид спереди"
																value={draft.alt_text}
																onChange={(event) => setDraft({...draft, alt_text: event.target.value})}
														/>
														<Input
																compact
																label="Порядок фото"
																type="number"
																min={1}
																max={MAX_ORDER_POSITION}
																step={1}
																required
																value={draft.sort_order}
																onChange={(event) => setDraft({...draft, sort_order: event.target.value})}
														/>
														<label className={s.checkbox}>
																<input
																		type="checkbox"
																		checked={primary ?? media.length === 0}
																		onChange={(event) => setPrimary(event.target.checked)}
																/>{" "}
																Сделать основным фото
														</label>
												</div>
												{preview && <img className={p.preview} src={preview} alt="Предпросмотр выбранного файла"/>}
												<div className={s.grid}>
														<Select
																compact
																label="Комплектация"
																value={draft.variant_id}
																onChange={(event) => setDraft({
																		...draft,
																		variant_id: event.target.value,
																		body_color_id: event.target.value ? "" : draft.body_color_id,
																})}
														>
																<option value="">Общее фото товара</option>
																{variants.map((variant) => (
																		<option key={variant.id} value={variant.id}>
																				{variantLabel(variant)}
																		</option>
																))}
														</Select>
														<Select
																compact
																label="Цвет корпуса"
																value={draft.body_color_id}
																disabled={Boolean(draft.variant_id)}
																onChange={(event) => setDraft({...draft, body_color_id: event.target.value})}
														>
																<option value="">Любой цвет</option>
																{colors.map((color) => (
																		<option key={color.id} value={color.id}>
																				{color.name}
																		</option>
																))}
														</Select>
												</div>
												<p className={s.hint}>
														{draft.variant_id
																? "Фото откроется только у выбранной комплектации. Привязку потом изменить нельзя."
																: "Без комплектации фото общее для товара. Цвет сужает его до этого покрытия. Привязку потом изменить нельзя."}
												</p>
										</fieldset>
										<FormError error={error}/>
										<div className={s.sectionHeader}>
												<p className={s.hint}>JPG, PNG или WebP, до 10 МиБ. Меньший порядок показывается первым.</p>
												<Button
														type="submit"
														size="compact"
														variant="ginger"
														isLoading={upload.isPending}
														disabled={busy || !file || query.isPending || Boolean(query.error)}
												>
														<ImagePlus size={15}/>
														Загрузить фото
												</Button>
										</div>
								</form>
						)}
						<RequestState
								pending={query.isPending}
								error={query.error}
								onRetry={query.refetch}
								isFetching={query.isFetching}
						/>
						{query.data &&
								!query.error &&
								(media.length ? (
										<>
												{!media.some((item) => item.is_primary) && (
														<p className={s.notice}>
																Основное фото не выбрано. Отметьте его в настройках фотографии, чтобы у товара была
																обложка.
														</p>
												)}
												<div className={p.mediaGrid}>
														{media.map((item) => (
																<article className={p.mediaCard} key={item.id}>
																		<img src={item.url} alt={item.alt_text || product.name} loading="lazy"/>
																		<div className={p.mediaBody}>
																				<div className={s.sectionHeader}>
																						<span className={s.hint}>Порядок: {orderToPosition(item.sort_order)}</span>
																						{item.is_primary && (
																								<span className={p.primary}>
                          <Star size={13}/> Основное
                        </span>
																						)}
																				</div>
																				<p>{item.alt_text || "Без описания"}</p>
																				<p className={s.hint}>{mediaScopeLabel(item, variants, catalog.options.body_color)}</p>
																				{!product.archived_at && (
																						<div className={s.actions}>
																								<Button size="compact" variant="soft" disabled={busy}
																												onClick={() => setEditing(item)}>
																										<Pencil size={14}/> Изменить
																								</Button>
																								<Button
																										size="compact"
																										variant="soft"
																										className={s.danger}
																										disabled={busy}
																										aria-label={`Удалить фото: ${item.alt_text || "без описания"}`}
																										onClick={() => {
																												remove.reset();
																												setDeleting(item);
																										}}
																								>
																										<Trash2 size={15}/>
																								</Button>
																						</div>
																				)}
																		</div>
																</article>
														))}
												</div>
										</>
								) : (
										<EmptyState>
												<p>Фотографии ещё не добавлены.</p>
										</EmptyState>
								))}
						{editing && <MediaEditor media={editing} mutation={update} onClose={() => setEditing(null)}/>}
						{deleting && (
								<ConfirmDialog
										title="Удалить фотографию?"
										confirmLabel="Удалить фото"
										pending={remove.isPending}
										error={remove.error}
										onClose={() => setDeleting(null)}
										onConfirm={() =>
												remove.mutate(deleting.id, {
														onSuccess: () => {
																setDeleting(null);
																toast.success("Фотография удалена");
														},
												})
										}
								>
										Фотография будет удалена из товара. Это действие нельзя отменить.
										{deleting.is_primary ? " После удаления выберите другое основное фото." : ""}
								</ConfirmDialog>
						)}
				</div>
		);
}