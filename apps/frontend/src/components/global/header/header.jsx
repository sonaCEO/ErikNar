import {navigation} from "./data.js";
import LayoutContainer from "../../grid/layout-container.jsx";
import Logo from "../../global/logo/logo.jsx";
import Button from "../../ui/button/button.jsx";
import s from "./header.module.css";
import {Phone} from 'lucide-react';

export default function Header() {
    return (
        <header className={s.header}>
            <LayoutContainer>
                <div className={s.wrapper}>
                    <Logo/>

                    <div className={s.inner}>
                        <nav>
                            <ul>
                                {navigation.map((item) => (<li key={item.id}>
                                    <a href={item.url}>{item.name}</a>
                                </li>))}
                            </ul>
                        </nav>
                        <div className={s.actions}>
                            <span>
                                <a href="tel:+79999999999">
                                    <Phone/>
                                    +7 999 999-99-99</a>
                            </span>
                            <Button variant="black" size='md'>Оставить заявку</Button>
                        </div>
                    </div>
                    <Button variant="burger"><span></span></Button>
                </div>
            </LayoutContainer>
        </header>);
}
