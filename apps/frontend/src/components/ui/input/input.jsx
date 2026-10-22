import clsx from "clsx";
import {Text} from "../typography/text/text";
import s from "./input.module.css";

export function Input({
		label,
		id,
		className,
		inputClassName,
		...props
}) {
		return (
				<label className={clsx(s.field, className)} htmlFor={id}>
						{label && (
								<Text as="span" variant="label">
										{label}
								</Text>
						)}
						<input
								id={id}
								className={clsx(s.input, inputClassName)}
								{...props}
						/>
				</label>
		);
}
