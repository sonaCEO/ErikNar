import clsx from "clsx";
import {Check, ChevronDown, ChevronUp} from "lucide-react";
import {useState} from "react";
import LayoutContainer from "../../grid/layout-container/layout-container";
import {TitleGroup} from "../../ui/title-group/title-group";
import {Text} from "../../ui/typography/text/text";
import {Title} from "../../ui/typography/title/title";
import {controlMeta, controlPanels} from "./data";
import s from "./control.module.css";

const TIMERS = [2, 4, 6];
const TEMP_MIN = 30;
const TEMP_MAX = 70;

function ElectronicDevice() {
		const [hours, setHours] = useState(4);
		const [on, setOn] = useState(true);

		return (
				<div className={clsx(s.device, !on && s.deviceOff)}>
						<div className={s.deviceShell}>
								<div className={s.deviceFace} role="group" aria-label="Электронная панель">
										{TIMERS.map((value, index) => (
												<div key={value} className={s.timerBlock}>
														<button
																type="button"
																className={clsx(s.timer, on && hours === value && s.timerOn)}
																aria-label={`Таймер ${value} часа`}
																disabled={!on}
																onClick={() => setHours(value)}
														>
																{value}h
														</button>
														{index < TIMERS.length - 1 && (
																<span
																		className={clsx(s.dot, on && hours === value && s.dotActive)}
																		aria-hidden="true"
																/>
														)}
												</div>
										))}

										<button
												type="button"
												className={clsx(s.power, on && s.powerOn)}
												aria-label={on ? "Выключить панель" : "Включить панель"}
												onClick={() => setOn((value) => !value)}
										/>
								</div>
						</div>
				</div>
		);
}

function TouchDevice() {
		const [temp, setTemp] = useState(55);
		const [on, setOn] = useState(true);

		function bump(delta) {
				setTemp((value) => Math.min(TEMP_MAX, Math.max(TEMP_MIN, value + delta)));
		}

		return (
				<div className={clsx(s.device, !on && s.deviceOff)}>
						<div className={s.deviceShell}>
								<div className={s.deviceFace} role="group" aria-label="Сенсорная панель">
										<span className={s.display} aria-live="polite">
												{on ? `${temp}°` : "—"}
										</span>

										<button
												type="button"
												className={s.chevron}
												aria-label="Повысить температуру"
												disabled={!on || temp >= TEMP_MAX}
												onClick={() => bump(1)}
										>
												<ChevronUp size={16} strokeWidth={2.5}/>
										</button>

										<button
												type="button"
												className={s.chevron}
												aria-label="Понизить температуру"
												disabled={!on || temp <= TEMP_MIN}
												onClick={() => bump(-1)}
										>
												<ChevronDown size={16} strokeWidth={2.5}/>
										</button>

										<button
												type="button"
												className={clsx(s.power, on && s.powerOn)}
												aria-label={on ? "Выключить панель" : "Включить панель"}
												onClick={() => setOn((value) => !value)}
										/>
								</div>
						</div>
				</div>
		);
}

const devices = {
		electronic: ElectronicDevice,
		touch: TouchDevice,
};

export function Control() {
		return (
				<section className={s.control} id="control">
						<LayoutContainer>
								<div className={s.inner}>
										<div className={s.heading}>
												<TitleGroup
														subtitle={controlMeta.subtitle}
														title={controlMeta.title}
														titleVariant="white"
														titleLevel={2}
														text={controlMeta.text}
														textVariant="caption"
												/>
										</div>

										<div className={s.cards}>
												{controlPanels.map((panel) => {
														const Device = devices[panel.device];

														return (
																<article key={panel.id} className={s.card}>
																		<span className={s.number} aria-hidden="true">
																				{panel.number}
																		</span>

																		<Device/>

																		<div className={s.info}>
																				<Title level={3} variant="white">
																						{panel.title}
																				</Title>

																				<Text as="p" variant="caption">
																						{panel.text}
																				</Text>

																				<ul className={s.features}>
																						{panel.features.map((feature) => (
																								<li key={feature} className={s.feature}>
																										<span className={s.check} aria-hidden="true">
																												<Check size={14} strokeWidth={2.5}/>
																										</span>
																										<Text as="span" variant="caption">
																												{feature}
																										</Text>
																								</li>
																						))}
																				</ul>
																		</div>
																</article>
														);
												})}
										</div>
								</div>
						</LayoutContainer>
				</section>
		);
}
