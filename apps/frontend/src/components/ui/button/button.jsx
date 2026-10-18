import clsx from 'clsx';
import s from './button.module.css'

export function Button({children, onClick, variant = 'black', size = 'md'}) {
		return (
				<button
						className={clsx(s.button, s[variant], s[size])}
						onClick={onClick}
				>
						{children}
				</button>
		);
}