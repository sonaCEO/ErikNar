import {Skeleton} from "../skeleton/skeleton";
import s from "./product-card.module.css";

export function ProductCardSkeleton() {
		return (
				<div className={s.card} aria-hidden="true">
						<Skeleton className={s.skeletonMedia}/>
						<div className={s.body}>
								<Skeleton style={{width: "30%"}}/>
								<div className={s.head}>
										<Skeleton style={{width: "52%", height: 24}}/>
										<Skeleton style={{width: "32%", height: 24}}/>
								</div>
								<div className={s.field}>
										<Skeleton/>
										<Skeleton/>
										<Skeleton style={{width: "65%"}}/>
								</div>
								<div className={s.swatches}>
										{Array.from({length: 5}, (_, index) => (
												<Skeleton key={index} className={s.skeletonSwatch}/>
										))}
								</div>
								<Skeleton style={{width: "60%", height: 24}}/>
								<Skeleton className={s.skeletonButton}/>
						</div>
				</div>
		);
}