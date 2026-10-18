import s from "./fact.module.css";

export function Fact({value, unit, label}) {
		return (
				<div className={s.fact}>
						<p className={s.metric}>
								<span className={s.value}>{value}</span>
								{unit && <span className={s.unit}>{unit}</span>}
						</p>
						<span className={s.label}>{label}</span>
				</div>
		);
}
