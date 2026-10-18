import clsx from 'clsx';
import s from './text.module.css';

export function Text({as: Component = 'p', variant = 'base', children, ...props}) {
    return (
        <Component
            className={clsx(s.text, s[variant])}
            {...props}
        >
            {children}
        </Component>
    );
}