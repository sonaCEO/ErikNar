import clsx from "clsx";
import {Text} from "../typography/text/text";
import s from "./textarea.module.css";

export function Textarea({
		label,
		id,
		className,
		textareaClassName,
		rows = 4,
		...props
}) {
		return (
				<label className={clsx(s.field, className)} htmlFor={id}>
						{label && (
								<Text as="span" variant="label">
										{label}
								</Text>
						)}
						<textarea
								id={id}
								className={clsx(s.textarea, textareaClassName)}
								rows={rows}
								{...props}
						/>
				</label>
		);
}
