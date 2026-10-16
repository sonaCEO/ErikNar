import clsx from 'clsx';
import s from './button.module.css'

function Button({children, onClick, variant='black'}) {
    return (
        <button
            className={clsx(s.button, s[variant])}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export default Button;