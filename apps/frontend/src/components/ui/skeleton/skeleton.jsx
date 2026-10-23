import clsx from "clsx";
import s from "./skeleton.module.css";

export function Skeleton({className, ...props}) {
		return <span className={clsx(s.skeleton, className)} aria-hidden="true" {...props} />;
}
