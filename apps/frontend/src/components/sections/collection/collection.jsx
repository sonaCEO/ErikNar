import {useState} from "react";
import LayoutContainer from "../../grid/layout-container/layout-container";
import {Button} from "../../ui/button/button";
import {ProductCard} from "../../ui/product-card/product-card";
import {ProductCardSkeleton} from "../../ui/product-card/product-card-skeleton";
import {useCatalogProducts} from "../../../hooks/queries/use-products";
import {TitleGroup} from "../../ui/title-group/title-group";
import {
		collectionMeta,
		PAGE_SIZE,
} from "./data";
import s from "./collection.module.css";

export function Collection() {
		const [tab, setTab] = useState("");
		const [visible, setVisible] = useState(PAGE_SIZE);
		const [retrying, setRetrying] = useState(false);
		const {products, pendingCount, isFetching, error, refetch} = useCatalogProducts();
		const categories = [...new Set(products.map((product) => product.category).filter(Boolean))];
		const activeTab = categories.includes(tab) ? tab : "";
		const tabs = [{id: "", label: "Все модели"}, ...categories.map((category) => ({id: category, label: category}))];

		const filtered = activeTab ? products.filter((product) => product.category === activeTab) : products;

		const items = filtered.slice(0, visible);
		const hasMore = visible < filtered.length;

		function handleTab(nextTab) {
				setTab(nextTab);
				setVisible(PAGE_SIZE);
		}

		async function retry() {
				setRetrying(true);
				try {
						await refetch();
				} finally {
						setRetrying(false);
				}
		}

		return (
				<section className={s.collection} id="collection">
						<LayoutContainer>
								<div className={s.inner}>
										<div className={s.heading}>
												<TitleGroup
														subtitle={collectionMeta.subtitle}
														title={collectionMeta.title}
														titleLevel={2}
														text={collectionMeta.text}
														textVariant="muted"
												/>
										</div>

										{categories.length > 1 && <div className={s.tabs} role="group" aria-label="Категория модели">
												{tabs.map((item) => (
														<Button
																key={item.id}
																variant="soft"
																size="sm"
																active={item.id === activeTab}
																aria-pressed={item.id === activeTab}
																onClick={() => handleTab(item.id)}
														>
																{item.label}
														</Button>
												))}
										</div>}

										{(error || retrying) && <div className={s.message} role={error ? "alert" : "status"}>
												<p>{retrying ? "Загрузка каталога..." : products.length ? "Не удалось загрузить часть моделей." : "Не удалось загрузить каталог."}</p>
												<Button variant="soft" size="sm" isLoading={isFetching || retrying} onClick={retry}>Повторить
														загрузку</Button>
										</div>}

										{pendingCount > 0 && <span className={s.srOnly} role="status">Загрузка каталога</span>}
										<div className={s.grid} aria-busy={pendingCount > 0}>
												{items.map((item) => (
														<ProductCard
																key={item.id}
																product={item}
																relatedProducts={products.filter((product) => product.id !== item.id).slice(0, 3)}
														/>
												))}
												{Array.from({length: Math.min(pendingCount, Math.max(0, visible - items.length))}, (_, index) =>
														<ProductCardSkeleton key={`loading-${index}`}/>)}
										</div>
										{!pendingCount && !error && !items.length &&
												<p className={s.message}>{activeTab ? "В этой категории пока нет моделей." : "В каталоге пока нет моделей."}</p>}

										{hasMore && (
												<div className={s.more}>
														<Button
																variant="black"
																size="lg"
																onClick={() => setVisible((count) => count + PAGE_SIZE)}
														>
																Показать ещё
														</Button>
												</div>
										)}
								</div>
						</LayoutContainer>
				</section>
		);
}
