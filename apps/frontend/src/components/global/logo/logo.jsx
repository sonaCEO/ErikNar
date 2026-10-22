import logo from "../../../assets/logo.png";
import s from "./logo.module.css";

export default function Logo({withDescription = true}) {
		return (
				<a href="/" className={s.logo}>
						<img className={s.image} src={logo} alt="ErikNar"/>
						{withDescription && (
								<span className={s.description}>
										<span>ErikNar</span>
										<span>дизайнерское тепло</span>
								</span>
						)}
				</a>
		);
}
