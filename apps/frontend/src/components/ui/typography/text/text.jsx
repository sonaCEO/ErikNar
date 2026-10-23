import clsx from 'clsx';
import s from './text.module.css';

export function Text({as: Component = 'p', variant = 'base', className, children, ...props}) {
    return (
        <Component
            className={clsx(s.text, s[variant], className)}
            {...props}
        >
            {children}
        </Component>
    );
}