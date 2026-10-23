import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { archiveProduct, createProduct, updateProduct } from "../../../api/admin/catalog";
import { useAdminProduct, useCatalogMutation } from "../../../hooks/queries/use-admin-catalog";
import { queryKeys } from "../../../hooks/queries/query-keys";
import { Button } from "../../../components/ui/button/button";
import { Input } from "../../../components/ui/input/input";
import { Textarea } from "../../../components/ui/textarea/textarea";
import { Badge } from "../../../components/ui/badge/badge";
import { Title } from "../../../components/ui/typography/title/title";
import { ConfirmDialog, FormError, RequestState } from "../admin-ui";
import { MAX_INTEGER, MAX_ORDER_POSITION, productDraft, productPayload } from "./product-form";
import { ProductMedia } from "./product-media";
import { ProductVariants } from "./product-variants";
import s from "../admin.module.css";

function ProductForm({ product, onCreated, onReload }) {
		const client = useQueryClient();
		const [draft, setDraft] = useState(() => productDraft(product));
		const [version, setVersion] = useState(product?.updated_at);
		const [error, setError] = useState(null);
		const [reloading, setReloading] = useState(false);
		const productId = product?.id;
		const save = useCatalogMutation((body) => (productId ? updateProduct(productId, body) : createProduct(body)), {
				kind: "product",
				product,
		});
		const archived = Boolean(product?.archived_at);

		function field(name) {
				return {
						value: draft[name],
						onChange: (event) => setDraft((previous) => ({ ...previous, [name]: event.target.value })),
				};
		}

		async function submit(event) {
				event.preventDefault();
				setError(null);
				try {
						const body = productPayload(draft);
						if (product) body.expected_updated_at = version;
						else body.is_published = false;
						const result = await save.mutateAsync(body);
						const saved = client.getQueryData(queryKeys.adminProduct(result.id)) ?? result;
						setVersion(saved.updated_at);
						setDraft(productDraft(saved));
						toast.success(product ? "Изменения сохранены" : "Товар создан. Добавьте комплектации и фотографии.");
						if (!product) onCreated(result.id);
				} catch (err) {
						setError(err);
				}
		}

		async function reload() {
				setReloading(true);
				try {
						const result = await onReload();
						if (result.error) throw result.error;
						setDraft(productDraft(result.data));
						setVersion(result.data.updated_at);
						setError(null);
				} catch (err) {
						setError(err);
				} finally {
						setReloading(false);
				}
		}

		return (
				<form className={s.stack} onSubmit={submit}>
						<fieldset disabled={save.isPending || archived || reloading} className={s.stack}>
								<section className={s.card}>
										<Title level={3}>Основная информация</Title>
										<div className={s.grid}>
												<Input
														compact
														label="Название товара"
														required
														maxLength={200}
														placeholder="Название модели"
														{...field("name")}
												/>
												<Input compact label="Код модели" required maxLength={80} placeholder="EN-600" {...field("model_code")} />
												<Input
														compact
														label="Адрес товара (slug)"
														required
														maxLength={120}
														placeholder="eriknar-600"
														{...field("slug")}
												/>
												<Input
														compact
														label="Категория"
														required
														maxLength={80}
														placeholder="Электрические полотенцесушители"
														{...field("category")}
												/>
												<Textarea
														compact
														className={s.fullWidth}
														label="Краткое описание"
														required
														maxLength={500}
														rows={3}
														placeholder="Описание для карточки в каталоге"
														{...field("short_description")}
												/>
												<Textarea
														compact
														className={s.fullWidth}
														label="Полное описание"
														required
														rows={6}
														placeholder="Особенности модели, материалы и преимущества"
														{...field("description")}
												/>
										</div>
										<p className={s.hint}>
												Код модели и адрес должны быть уникальными. Для адреса используйте латиницу, цифры и дефисы.
										</p>
								</section>

								<section className={s.card}>
										<Title level={3}>Характеристики</Title>
										<div className={s.grid}>
												<Input
														compact
														label="Тип нагревателя"
														required
														maxLength={120}
														placeholder="Например, сухой ТЭН"
														{...field("heater_type")}
												/>
												<Input
														compact
														label="Максимальная температура, °C"
														type="number"
														required
														min={1}
														max={MAX_INTEGER}
														step={1}
														{...field("max_temperature")}
												/>
												<Input
														compact
														label="Гарантия, месяцев"
														type="number"
														required
														min={0}
														max={MAX_INTEGER}
														step={1}
														{...field("warranty_months")}
												/>
												<Input
														compact
														label="Порядок в каталоге"
														type="number"
														required
														min={1}
														max={MAX_ORDER_POSITION}
														step={1}
														{...field("sort_order")}
												/>
										</div>
										<p className={s.hint}>Размеры, цены, цвета и наличие задаются отдельно для каждой комплектации.</p>
								</section>

								<section className={s.card}>
										<Title level={3}>Публикация</Title>
										{product ? (
												<>
														<label className={s.checkbox}>
																<input
																		type="checkbox"
																		checked={draft.is_published}
																		onChange={(event) =>
																				setDraft((previous) => ({
																						...previous,
																						is_published: event.target.checked,
																				}))
																		}
																/>{" "}
																Показывать товар на сайте
														</label>
														<p className={s.hint}>
																Перед публикацией добавьте хотя бы одну активную комплектацию и основную фотографию. Снятие с публикации не
																удаляет товар.
														</p>
												</>
										) : (
												<p className={s.muted}>
														Сначала сохраним черновик. После добавления комплектаций и фотографий товар можно опубликовать.
												</p>
										)}
								</section>
						</fieldset>

						<FormError error={error} />

						{error?.code === "concurrent_update" && (
								<div className={s.notice}>
										<p>Текущий ввод сохранён в форме. Кнопка ниже заменит его актуальными данными с сервера.</p>
										<Button size="compact" variant="soft" isLoading={reloading} onClick={reload}>
												Загрузить актуальную версию
										</Button>
								</div>
						)}

						{!archived && (
								<div className={s.formFooter}>
										<Button type="submit" size="compact" variant="ginger" isLoading={save.isPending} disabled={reloading}>
												<Save size={15} />
												{product ? "Сохранить изменения" : "Создать товар"}
										</Button>
								</div>
						)}
				</form>
		);
}

export function ProductEditorPage() {
		const { productId } = useParams();
		const navigate = useNavigate();
		const query = useAdminProduct(productId);
		const product = query.data;
		const [tab, setTab] = useState("details");
		const [confirmArchive, setConfirmArchive] = useState(false);
		const archive = useCatalogMutation(({ id, updated_at }) => archiveProduct(id, updated_at), {
				kind: "product",
				product,
		});

		if (productId && (query.isPending || query.error)) {
				return (
						<div className={s.page}>
								<Link to="/admin/products" className={s.back}>
										<ArrowLeft size={15} /> К товарам
								</Link>
								<RequestState
										pending={query.isPending}
										error={query.error}
										onRetry={query.refetch}
										isFetching={query.isFetching}
								/>
						</div>
				);
		}

		return (
				<div className={s.page}>
						<Link to="/admin/products" className={s.back}>
								<ArrowLeft size={15} /> К товарам
						</Link>
						<header className={s.header}>
								<div>
										<Title level={1}>{product ? product.name : "Новый товар"}</Title>
										<p className={s.muted}>
												{product ? `Модель ${product.model_code}` : "Создайте модель, затем добавьте её комплектации и фото."}
										</p>
								</div>
								{product && (
										<div className={s.actions}>
												<Badge
														variant={
																product.archived_at ? "out_of_stock" : product.is_published ? "in_stock" : "made_to_order"
														}
												>
														{product.archived_at ? "В архиве" : product.is_published ? "Опубликован" : "Черновик"}
												</Badge>
												{!product.archived_at && (
														<Button
																size="compact"
																variant="soft"
																className={s.danger}
																onClick={() => {
																		archive.reset();
																		setConfirmArchive(true);
																}}
														>
																<Archive size={15} /> В архив
														</Button>
												)}
										</div>
								)}
						</header>

						{product?.archived_at && <p className={s.muted}>Товар в архиве и не отображается на сайте.</p>}

						{product && (
								<div className={s.actions} role="group" aria-label="Разделы товара">
										{[
												["details", "Основное"],
												["variants", "Комплектации"],
												["media", "Фотографии"],
										].map(([value, label]) => (
												<Button
														key={value}
														size="compact"
														variant="soft"
														active={tab === value}
														aria-pressed={tab === value}
														onClick={() => setTab(value)}
												>
														{label}
												</Button>
										))}
								</div>
						)}

						<div hidden={Boolean(product) && tab !== "details"}>
								<ProductForm
										key={productId ?? "new"}
										product={product}
										onCreated={(id) => navigate(`/admin/products/${id}`, { replace: true })}
										onReload={query.refetch}
								/>
						</div>

						{product && tab === "variants" && <ProductVariants key={product.id} product={product} />}
						{product && tab === "media" && <ProductMedia key={product.id} product={product} />}

						{confirmArchive && (
								<ConfirmDialog
										title="Архивировать товар?"
										confirmLabel="Архивировать"
										pending={archive.isPending}
										error={archive.error}
										onClose={() => setConfirmArchive(false)}
										onConfirm={() =>
												archive.mutate(product, {
														onSuccess: () => {
																toast.success("Товар перемещён в архив");
																navigate("/admin/products");
														},
												})
										}
								>
										Товар «{product.name}» будет снят с публикации. Архивирование нельзя отменить. Чтобы временно скрыть модель,
										снимите флажок публикации.
								</ConfirmDialog>
						)}
				</div>
		);
}