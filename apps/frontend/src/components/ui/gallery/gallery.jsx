import clsx from "clsx";
import s from "./gallery.module.css";

export function Gallery({
		items = [],
		activeIndex = 0,
		onSelect,
		className,
		compact = false,
}) {
		const active = items[activeIndex] ?? items[0];

		if (!active) return null;

		return (
				<div className={clsx(s.gallery, compact && s.compact, className)}>
						<figure className={s.stage}>
								<img
										className={s.image}
										src={active.url}
										alt={active.alt_text || ""}
										decoding="async"
								/>
						</figure>

						{items.length > 1 && (
								<ul className={s.thumbs} aria-label="Галерея">
										{items.map((item, index) => (
												<li key={item.id}>
														<button
																type="button"
																className={clsx(s.thumb, index === activeIndex && s.thumbActive)}
																aria-label={item.alt_text || `Фото ${index + 1}`}
																aria-current={index === activeIndex ? "true" : undefined}
																onClick={() => onSelect?.(index)}
														>
																<img
																		className={s.thumbImage}
																		src={item.url}
																		alt=""
																		decoding="async"
																/>
														</button>
												</li>
										))}
								</ul>
						)}
				</div>
		);
}
