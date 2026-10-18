import s from "./fact.module.css";

export function Fact({value, label}) {
		return (
				<div className={s.fact}>
						<span className={s.value}>{value}</span>
						<span className={s.label}>{label}</span>
				</div>
		);
}
