import {useId, useState} from "react";
import {Modal} from "../../ui/modal/modal";
import {TitleGroup} from "../../ui/title-group/title-group";
import {Input} from "../../ui/input/input";
import {Textarea} from "../../ui/textarea/textarea";
import {Button} from "../../ui/button/button";
import {formatPhoneRu, isPhoneRuComplete} from "../../../utils/phone";
import s from "./consultation-modal.module.css";

const initialForm = {
		name: "",
		phone: "",
		comment: "",
};

export function ConsultationModal({open, onClose, onExited}) {
		const titleId = useId();
		const nameId = useId();
		const phoneId = useId();
		const commentId = useId();
		const [form, setForm] = useState(initialForm);

		function update(field) {
				return (event) => {
						setForm((prev) => ({
								...prev,
								[field]: event.target.value,
						}));
				};
		}

		function handlePhoneChange(event) {
				setForm((prev) => ({
						...prev,
						phone: formatPhoneRu(event.target.value),
				}));
		}

		function handleSubmit(event) {
				event.preventDefault();
				if (!isPhoneRuComplete(form.phone)) return;

				onClose?.();
				setForm(initialForm);
		}

		return (
				<Modal
						open={open}
						onClose={onClose}
						onExited={onExited}
						labelledBy={titleId}
				>
						<div className={s.content}>
								<div id={titleId}>
										<TitleGroup
												className={s.heading}
												subtitle="Персональная консультация"
												title="Подберём идеальную модель"
												titleLevel={3}
												text="Оставьте контакты - обсудим размер, цвет и тип управления."
												textVariant="muted"
										/>
								</div>

								<form className={s.form} onSubmit={handleSubmit}>
										<Input
												id={nameId}
												label="Ваше имя"
												name="name"
												autoComplete="name"
												placeholder="Как к вам обращаться?"
												value={form.name}
												onChange={update("name")}
												required
										/>

										<Input
												id={phoneId}
												label="Телефон"
												name="phone"
												type="tel"
												inputMode="tel"
												autoComplete="tel"
												placeholder="+7 999 000-00-00"
												value={form.phone}
												onChange={handlePhoneChange}
												minLength={16}
												required
										/>

										<Textarea
												id={commentId}
												label="Комментарий"
												name="comment"
												placeholder="Например: нужна модель по своим размерам"
												value={form.comment}
												onChange={update("comment")}
												rows={4}
										/>

										<Button
												type="submit"
												variant="ginger"
												size="lg"
												className={s.submit}
										>
												Отправить заявку
										</Button>
								</form>
						</div>
				</Modal>
		);
}
