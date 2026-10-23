import clsx from "clsx";
import {Text} from "../typography/text/text";
import s from "./color-picker.module.css";

export function ColorPicker({colors, value, onChange}) {
		const selected = colors.find((color) => color.id === value);
		if (!colors.length) return null;

		return <div className={s.picker}>
				<Text as="span" variant="label" className={s.label}>Цвет{selected ? ` (${selected.name})` : ""}</Text>
				<div className={s.options} role="group" aria-label="Цвет корпуса">
						{colors.map((color) => <button
								key={color.id}
								type="button"
								className={clsx(s.swatch, color.id === value && s.active)}
								title={color.name}
								aria-label={color.name}
								aria-pressed={color.id === value}
								onClick={() => onChange(color.id)}
						>
								<span className={s.fill} style={{backgroundColor: color.hex_value}}/>
						</button>)}
				</div>
		</div>;
}
