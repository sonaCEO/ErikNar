import s from './button.module.css'

function Button({ children, onClick, variant = 'black' }) {
		return (
				<button
						/* Базовый класс лучше button использовать и ты забыла props добавить - variant, чтобы мы могли менять тип кнопки) */
						className={`${s.button} ${variant === 'ginger' ? s.ginger : s.black}`}
						onClick={onClick}
				>
						{children}
				</button>
		);
}

export default Button;