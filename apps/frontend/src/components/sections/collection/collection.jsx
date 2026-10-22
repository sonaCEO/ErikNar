import {useState} from "react";
import LayoutContainer from "../../grid/layout-container/layout-container";
import {Button} from "../../ui/button/button";
import {ProductCard} from "../../ui/product-card/product-card";
import {TitleGroup} from "../../ui/title-group/title-group";
import {
		collectionMeta,
		collectionProducts,
		collectionTabs,
		PAGE_SIZE,
} from "./data";
import s from "./collection.module.css";

export function Collection() {
		const [tab, setTab] = useState("all");
		const [visible, setVisible] = useState(PAGE_SIZE);

		const filtered = tab === "all"
				? collectionProducts
				: collectionProducts.filter((item) => item.type === tab);

		const items = filtered.slice(0, visible);
		const hasMore = visible < filtered.length;

		function handleTab(nextTab) {
				setTab(nextTab);
				setVisible(PAGE_SIZE);
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

										<div className={s.tabs} role="tablist" aria-label="Тип модели">
												{collectionTabs.map((item) => (
														<Button
															key={item.id}
															variant="soft"
															size="sm"
															active={item.id === tab}
															role="tab"
															aria-selected={item.id === tab}
															onClick={() => handleTab(item.id)}
														>
																{item.label}
														</Button>
												))}
										</div>

										<div className={s.grid}>
												{items.map((product) => (
														<ProductCard
															key={product.id}
															image={product.image}
															name={product.name}
															priceFrom={product.priceFrom}
															description={product.description}
															colors={product.colors}
															sizes={product.sizes}
															availabilityStatus={product.availabilityStatus}
														/>
												))}
										</div>

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
