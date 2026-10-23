import clsx from "clsx";
import s from "./badge.module.css";

export function Badge({children, variant = "in_stock"}) {
		return (
				<span className={clsx(s.badge, s[variant])}>
						{children}
				</span>
		);
}
