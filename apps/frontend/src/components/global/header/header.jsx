import { navigation } from "./data.js";
import logo from "../../../assets/logo.png";

export default function Header() {
  return (
    <header>
      <div>
        <a href="/">
          <img src={logo} alt="ErikNarLogo" />
          <span>
            <span>ErikNar</span>
            <span>дизайнерское тепло</span>
          </span>
        </a>

        <div>
          <nav>
            <ul>
              {navigation.map((item) => (
                <li key={item.id}>
                  <a href={item.url}>{item.name}</a>
                </li>
              ))}
            </ul>
          </nav>

          <a href="tel:+79999999999">+7 999 999-99-99</a>
          <button>Оставть заявку</button>
        </div>
      </div>
    </header>
  );
}
