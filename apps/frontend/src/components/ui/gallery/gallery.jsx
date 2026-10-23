import clsx from "clsx";
import {Image} from "../image/image";
import s from "./gallery.module.css";

export function Gallery({
														items = [],
														activeIndex = 0,
														onSelect,
														className,
														compact = false,
														fit = "cover",
												}) {
		const active = items[activeIndex] ?? items[0];

		return (
				<div className={clsx(s.gallery, compact && s.compact, className)}>
						<figure className={s.stage}>
								<Image
										key={active?.url}
										className={s.image}
										src={active?.url}
										alt={active?.alt_text || ""}
										loading="eager"
										fit={fit}
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
																		className={clsx(s.thumbImage, fit === "contain" && s.thumbContain)}
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
