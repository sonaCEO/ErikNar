import clsx from "clsx";
import styles from "./layout-container.module.css";

export default function LayoutContainer({children, className}) {
  return (
    <div className={clsx(styles.container, className)}>
      {children}
    </div>
  );
}
