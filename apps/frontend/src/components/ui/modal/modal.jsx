import {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {X} from "lucide-react";
import {RemoveScroll} from "react-remove-scroll";
import clsx from "clsx";
import {Button} from "../button/button";
import s from "./modal.module.css";

export function Modal({
		open,
		onClose,
		onExited,
		children,
		className,
		labelledBy,
		describedBy,
}) {
		const [rendered, setRendered] = useState(open);
		const [entered, setEntered] = useState(false);
		const [prevOpen, setPrevOpen] = useState(open);

		if (open !== prevOpen) {
				setPrevOpen(open);

				if (open) {
						setRendered(true);
						setEntered(false);
				} else {
						setEntered(false);
				}
		}

		useEffect(() => {
				if (!open || !rendered) return undefined;

				let innerFrame = 0;
				const outerFrame = requestAnimationFrame(() => {
						innerFrame = requestAnimationFrame(() => setEntered(true));
				});

				return () => {
						cancelAnimationFrame(outerFrame);
						cancelAnimationFrame(innerFrame);
				};
		}, [open, rendered]);

		useEffect(() => {
				if (!rendered) return undefined;

				function onKeyDown(event) {
						if (event.key === "Escape") onClose?.();
				}

				window.addEventListener("keydown", onKeyDown);
				return () => window.removeEventListener("keydown", onKeyDown);
		}, [rendered, onClose]);

		function handleTransitionEnd(event) {
				if (event.target !== event.currentTarget) return;
				if (event.propertyName !== "opacity") return;
				if (open) return;

				setRendered(false);
				onExited?.();
		}

		if (!rendered) return null;

		return createPortal(
				<RemoveScroll enabled>
						<div
								className={clsx(s.root, entered && s.entered)}
								role="presentation"
								onTransitionEnd={handleTransitionEnd}
						>
								<button
										type="button"
										className={s.overlay}
										aria-label="Закрыть"
										onClick={onClose}
								/>

								<div
										className={clsx(s.dialog, className)}
										role="dialog"
										aria-modal="true"
										aria-labelledby={labelledBy}
										aria-describedby={describedBy}
								>
										<Button
												variant="soft"
												size="mini"
												className={s.close}
												aria-label="Закрыть"
												onClick={onClose}
										>
												<X size={20} strokeWidth={2} aria-hidden="true"/>
										</Button>

										{children}
								</div>
						</div>
				</RemoveScroll>,
				document.body,
		);
}
