import logo from "../../../assets/logo.png";
import s from "./logo.module.css";

function Logo() {
  return (
    <a href="/" className={s.logo}>
      <img className={s.image} src={logo} alt="ErikNarLogo" />
      <span className={s.description}>
        <span>ErikNar</span>
        <span>дизайнерское тепло</span>
      </span>
    </a>
  );
}

export default Logo;
