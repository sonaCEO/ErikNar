import s from './button.module.css'
function Button({children, onClick}) {
    return (
        <button className={s.default} onClick={onClick}>{children}</button>
    );
}

export default Button;