import {useEffect, useRef, useState} from "react";
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
													rootClassName,
													closeClassName,
													labelledBy,
													describedBy,
											}) {
		const [rendered, setRendered] = useState(open);
		const [entered, setEntered] = useState(false);
		const [prevOpen, setPrevOpen] = useState(open);
		const dialogRef = useRef(null);

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
				const previousFocus = document.activeElement;
				const dialog = dialogRef.current;
				const firstInput = dialog?.querySelector('input:not(:disabled):not([type="radio"]):not([type="checkbox"]), select:not(:disabled), textarea:not(:disabled)');
				(firstInput ?? dialog)?.focus({preventScroll: true});
				return () => {
						if (previousFocus?.isConnected) previousFocus.focus({preventScroll: true});
				};
		}, [rendered]);

		useEffect(() => {
				if (!rendered) return undefined;

				function onKeyDown(event) {
						if (event.key === "Escape") onClose?.();
						if (event.key !== "Tab") return;
						const items = [...(dialogRef.current?.querySelectorAll(
								'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
						) ?? [])].filter((element) => element.getClientRects().length > 0);
						const first = items[0];
						const last = items.at(-1);
						if (!first) {
								event.preventDefault();
						} else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
								event.preventDefault();
								last.focus();
						} else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
								event.preventDefault();
								first.focus();
						}
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
								className={clsx(s.root, entered && s.entered, rootClassName)}
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
										ref={dialogRef}
										tabIndex={-1}
										role="dialog"
										aria-modal="true"
										aria-labelledby={labelledBy}
										aria-describedby={describedBy}
								>
										<Button
												variant="soft"
												size="mini"
												className={clsx(s.close, closeClassName)}
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
