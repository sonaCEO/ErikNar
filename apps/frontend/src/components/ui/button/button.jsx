import clsx from 'clsx';
import s from './button.module.css'

function Button({children, onClick, variant='black', size='md'}) {
    return (
        <button
            className={clsx(s.button, s[variant], s[size])}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export default Button;