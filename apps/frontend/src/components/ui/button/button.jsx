import clsx from 'clsx';
import {Spinner} from '../spinner/spinner';
import s from './button.module.css'

export function Button({
		children,
		onClick,
		variant = 'black',
		size = 'md',
		active = false,
		type = 'button',
		className,
		isLoading = false,
		disabled = false,
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
								isLoading && s.loading,
								className,
						)}
						onClick={onClick}
						aria-pressed={active || undefined}
						{...props}
						disabled={disabled || isLoading}
						aria-busy={isLoading || undefined}
				>
						{variant === "burger" ? children : <span className={s.content}>{children}</span>}
						{isLoading && <span className={s.loader}><Spinner size={size === "mini" ? 14 : 18} /></span>}
				</button>
		);
}
