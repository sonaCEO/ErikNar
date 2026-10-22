import s from './title.module.css'

export function Title({level = 2, children, variant = 'black'}) {
		const Tag = `h${level}`;

		return (
				<Tag className={s[variant]}>{children}</Tag>
		);
}
