import s from './title.module.css'
import clsx from "clsx";

export function Title({level = 2, children, variant = 'black'}) {
    const Tag = `h${level}`;

    return (
        <Tag className={clsx(s[variant])}>{children}</Tag>
    );
}