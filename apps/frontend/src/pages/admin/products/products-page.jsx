import {useState} from "react";
import {Link, useNavigate} from "react-router";
import {Plus, RefreshCw} from "lucide-react";
import clsx from "clsx";
import {toast} from "sonner";
import {updateProduct} from "../../../api/admin/catalog";
import {useCatalogMutation, useAdminProducts} from "../../../hooks/queries/use-admin-catalog";
import {Button} from "../../../components/ui/button/button";
import {Badge} from "../../../components/ui/badge/badge";
import {Title} from "../../../components/ui/typography/title/title";
import {EmptyState, Pagination, RequestState} from "../admin-ui";
import s from "../admin.module.css";
import p from "./products.module.css";

export function ProductsPage() {
		const [page, setPage] = useState(1);
		const navigate = useNavigate();
		const query = useAdminProducts(page);
		const publication = useCatalogMutation(
				({product, isPublished}) => updateProduct(product.id, {
						is_published: isPublished,
						expected_updated_at: product.updated_at,
				}),
				{kind: "product"},
		);
		const {data, isPending, error, isFetching, isPlaceholderData, refetch} = query;

		return (
				<div className={s.page}>
						<header className={s.header}>
								<div>
										<Title level={1}>Товары</Title>
								</div>
								<Button size="compact" variant="ginger" onClick={() => navigate("/admin/products/new")}>
										<Plus size={16}/> Добавить товар
								</Button>
						</header>

						<div className={p.listToolbar}>
								<p className={s.hint}>{data ? `${data.total} моделей в каталоге` : "Каталог моделей"}</p>
								<Button size="compact" variant="soft" isLoading={isFetching} onClick={() => refetch()}>
										<RefreshCw size={14}/> Обновить
								</Button>
						</div>

						<RequestState pending={isPending} error={error} onRetry={refetch} isFetching={isFetching}/>

						{data &&
								!error &&
								(data.items.length ? (
										<div
												className={clsx(s.tableWrap, s.responsiveWrap, isPlaceholderData && s.dimmed)}
												aria-busy={isFetching}
										>
													<table className={clsx(s.table, s.responsiveTable, p.productTable)}>
														<thead>
														<tr>
														<th scope="col">Модель</th>
														<th scope="col">Статус</th>
														<th scope="col">Код модели</th>
											<th scope="col">Действие</th>
														</tr>
														</thead>
														<tbody>
														{data.items.map((product) => (
																<tr key={product.id}>
																		<td>
																<Link className={p.productName} to={`/admin/products/${product.id}`}>
																						{product.name}
																				</Link>
																				<span className={s.subline}>{product.slug}</span>
																		</td>
															<td data-label="Статус">
																				<Badge
																						variant={
																								product.archived_at
																										? "out_of_stock"
																										: product.is_published
																												? "in_stock"
																												: "made_to_order"
																						}
																				>
																						{product.archived_at
																								? "В архиве"
																								: product.is_published
																										? "Опубликован"
																										: "Черновик"}
																				</Badge>
																		</td>
															<td data-label="Код модели">{product.model_code}</td>
											<td data-label="Действие" className={p.rowAction}>
												{product.archived_at ? (
													<span className={s.hint}>В архиве</span>
												) : (
													<Button
														size="compact"
														variant={product.is_published ? "soft" : "ginger"}
														isLoading={publication.isPending && publication.variables?.product.id === product.id}
														disabled={publication.isPending}
														onClick={() => publication.mutate(
															{product, isPublished: !product.is_published},
															{
																	onSuccess: () => toast.success(product.is_published ? "Товар скрыт" : "Товар опубликован"),
																onError: (err) => toast.error(err.message),
															},
														)}
													>
																{product.is_published ? "Скрыть товар" : "Опубликовать"}
													</Button>
												)}
											</td>
																</tr>
														))}
														</tbody>
												</table>
										</div>
								) : (
										<EmptyState>
												<Title level={3}>
														{page === 1 ? "В каталоге пока нет товаров" : "На этой странице нет товаров"}
												</Title>
												<p>Создайте модель, добавьте комплектации и фотографии.</p>
										</EmptyState>
								))}

						{data && <Pagination page={page} total={data.total} onChange={setPage} pending={isFetching}/>}
				</div>
		);
}
