import {navigation} from "./data.js";
import LayoutContainer from "../../grid/layout-container.jsx";
import Logo from "../../global/logo/logo.jsx";
import s from "./header.module.css";

export default function Header() {
    return (
        <header className={s.header}>
            <LayoutContainer>
                <div className={s.wrapper}>
                    <Logo/>

                    <div className={s.inner}>
                        <nav>
                            <ul>
                                {navigation.map((item) => (
                                    <li key={item.id}>
                                        <a href={item.url}>{item.name}</a>
                                    </li>))}
                            </ul>
                        </nav>
                        <div className={s.actions}>
                            <a href="tel:+79999999999">+7 999 999-99-99</a>
                            <button>Оставть заявку</button>
                        </div>
                    </div>
                </div>
            </LayoutContainer>
        </header>);
}
