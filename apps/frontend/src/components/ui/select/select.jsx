import clsx from "clsx";
import {Text} from "../typography/text/text";
import s from "../input/input.module.css";

export function Select({label, id, compact = false, className, children, ...props}) {
		return (
				<label className={clsx(s.field, compact && s.compact, className)} htmlFor={id}>
						{label && <Text as="span" variant="label">{label}</Text>}
						<select id={id} className={s.input} {...props}>
								{children}
						</select>
				</label>
		);
}
