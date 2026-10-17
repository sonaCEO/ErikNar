import s from './title.module.css'
import clsx from "clsx";

function Title({level, children, variant = 'black'}) {
    const Tag = `h${level}`;

    return (
        <Tag className={clsx(s[variant])}>{children}</Tag>
    );
}

export default Title;