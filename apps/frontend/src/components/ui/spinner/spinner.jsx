import clsx from "clsx";
import {LoaderCircle} from "lucide-react";
import s from "./spinner.module.css";

export function Spinner({size = 18, className}) {
		return <LoaderCircle size={size} className={clsx(s.spinner, className)} aria-hidden="true"/>;
}
