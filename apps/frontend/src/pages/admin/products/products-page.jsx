import {useState} from "react";
import {Link, useNavigate} from "react-router";
import {Plus, RefreshCw} from "lucide-react";
import clsx from "clsx";
import {useAdminProducts} from "../../../hooks/queries/use-admin-catalog";
import {Button} from "../../../components/ui/button/button";
import {Badge} from "../../../components/ui/badge/badge";
import {Title} from "../../../components/ui/typography/title/title";
import {EmptyState, Pagination, RequestState} from "../admin-ui";
import {orderToPosition} from "./product-form";
import s from "../admin.module.css";

export function ProductsPage() {
		const [page, setPage] = useState(1);
		const navigate = useNavigate();
		const query = useAdminProducts(page);
		const {data, isPending, error, isFetching, isPlaceholderData, refetch} = query;

		return (
				<div className={s.page}>
						<header className={s.header}>
								<div>
										<Title level={1}>Товары</Title>
										<p className={s.muted}>
												Каталог моделей, комплектации и фотографии{data ? ` · Всего: ${data.total}` : ""}
										</p>
								</div>
								<Button size="compact" variant="ginger" onClick={() => navigate("/admin/products/new")}>
										<Plus size={16}/> Добавить товар
								</Button>
						</header>

						<div className={s.toolbar}>
								<p className={s.hint}>Все товары</p>
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
												<table className={clsx(s.table, s.responsiveTable)}>
														<thead>
														<tr>
																<th scope="col">Модель</th>
																<th scope="col">Код</th>
																<th scope="col">Категория</th>
																<th scope="col">Статус</th>
																<th scope="col">Порядок</th>
																<th scope="col">Действия</th>
														</tr>
														</thead>
														<tbody>
														{data.items.map((product) => (
																<tr key={product.id}>
																		<td>
																				<Link className={s.name} to={`/admin/products/${product.id}`}>
																						{product.name}
																				</Link>
																				<span className={s.subline}>{product.slug}</span>
																		</td>
																		<td data-label="Код модели">{product.model_code}</td>
																		<td data-label="Категория">{product.category}</td>
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
																		<td data-label="Порядок">{orderToPosition(product.sort_order)}</td>
																		<td>
																				<Link className={s.textLink} to={`/admin/products/${product.id}`}>
																						Открыть
																				</Link>
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