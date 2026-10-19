import clsx from 'clsx';
import s from './button.module.css'

export function Button({
		children,
		onClick,
		variant = 'black',
		size = 'md',
		active = false,
		type = 'button',
		className,
		...props
}) {
		const sized = variant !== "burger" && variant !== "underline";

		return (
				<button
						type={type}
						className={clsx(
								s.button,
								s[variant],
								sized && s[size],
								active && s.active,
								className,
						)}
						onClick={onClick}
						aria-pressed={active || undefined}
						{...props}
				>
						{children}
				</button>
		);
}
