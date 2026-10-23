import {useId, useState} from "react";
import {Link, useParams} from "react-router";
import {toast} from "sonner";
import {useAdminLead} from "../../../hooks/queries/use-admin-leads";
import {
		useAssignLead,
		useChangeLeadStatus,
		useClaimLead,
} from "../../../hooks/queries/use-lead-actions";
import {useAuth} from "../../../auth/auth-context";
import {ApiError} from "../../../api/client";
import {Badge} from "../../../components/ui/badge/badge";
import {Button} from "../../../components/ui/button/button";
import {Textarea} from "../../../components/ui/textarea/textarea";
import {Input} from "../../../components/ui/input/input";
import {Select} from "../../../components/ui/select/select";
import {useSessionRecords} from "../../../hooks/queries/use-admin-catalog";
import {queryKeys} from "../../../hooks/queries/query-keys";
import {UUID_PATTERN} from "../products/product-form";
import {RequestState} from "../admin-ui";
import {Text} from "../../../components/ui/typography/text/text";
import {Title} from "../../../components/ui/typography/title/title";
import {formatPriceMinor, formatSizeMm} from "../../../utils/format";
import {
		LEAD_STATUS_LABEL,
		LEAD_STATUS_BADGE_VARIANT,
} from "../leads/lead-status";
import s from "./lead-detail-page.module.css";

function formatDate(iso) {
		return new Date(iso).toLocaleString("ru-RU", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
		});
}

const HISTORY_ACTION_LABEL = {
		claimed: "Взята в работу",
		status_changed: "Статус изменён",
		assigned: "Ответственная назначена",
		unassigned: "Ответственная снята",
};

function actionErrorMessage(error) {
		if (error instanceof ApiError && error.code === "concurrent_update") {
				return "Заявку уже изменили в другой вкладке или в Telegram. Карточка обновлена — повторите действие.";
		}
		return error?.message ?? "Не удалось выполнить действие";
}

export function LeadDetailPage() {
		const {leadId} = useParams();
		const commentId = useId();
		const {user} = useAuth();
		const {data: lead, isPending, isError, error} = useAdminLead(leadId);

		const claim = useClaimLead(leadId);
		const changeStatus = useChangeLeadStatus(leadId);
		const assign = useAssignLead(leadId);

		const [comment, setComment] = useState("");
		const [assigneeId, setAssigneeId] = useState("");
		const [manualAssignee, setManualAssignee] = useState(false);
		const employees = useSessionRecords(queryKeys.adminEmployees);

		const actionPending = claim.isPending || changeStatus.isPending || assign.isPending;

		function runAction(mutation, variables, successMessage) {
				mutation.mutate(variables, {
						onError: (err) => toast.error(actionErrorMessage(err)),
						onSuccess: (result) => {
								if (mutation === claim && result.assigned_to?.id !== user.id) {
										toast.info(
												`Заявку уже взял другой сотрудник${result.assigned_to?.name ? `: ${result.assigned_to.name}` : ""}. Карточка обновлена.`
										);
										return;
								}
								setComment("");
								toast.success(successMessage);
						},
				});
		}

		if (isPending) {
				return <RequestState pending/>;
		}

		if (isError) {
				return (
						<div className={s.page}>
								<Link to="/admin" className={s.back}>
										← К списку заявок
								</Link>
								<p className={s.error} role="alert">
										{error?.message ?? "Не удалось загрузить заявку"}
								</p>
						</div>
				);
		}

		const snapshot = lead.snapshot;
		const isOpen = lead.status === "new" || lead.status === "in_progress";
		const canAssign = user?.role === "admin";
		const canChangeStatus = canAssign || lead.assigned_to?.id === user.id;
		const assignees = [
				...new Map(
						[user, ...employees.filter((employee) => employee.is_active), lead.assigned_to]
								.filter(Boolean)
								.map((employee) => [employee.id, employee])
				).values(),
		];

		return (
				<div className={s.page}>
						<Link to="/admin" className={s.back}>
								← К списку заявок
						</Link>

						<header className={s.header}>
								<div className={s.heading}>
										<Title level={1}>Заявка №{String(lead.number).padStart(4, "0")}</Title>
										<Badge variant={LEAD_STATUS_BADGE_VARIANT[lead.status]}>
												{LEAD_STATUS_LABEL[lead.status]}
										</Badge>
								</div>
								<Text as="p" variant="muted">
										Создана {formatDate(lead.created_at)} · Источник:{" "}
										{lead.source === "website" ? "сайт" : "Telegram"}
								</Text>
						</header>

						<div className={s.columns}>
								<div className={s.infoCol}>
										<section className={s.card}>
												<Text as="span" variant="subtitle">
														Клиент
												</Text>
												<dl className={s.specs}>
														<div className={s.spec}>
																<dt>Имя</dt>
																<dd>{lead.customer_name}</dd>
														</div>
														<div className={s.spec}>
																<dt>Телефон</dt>
																<dd>
																		<a href={`tel:${lead.customer_phone.replace(/[^\d+]/g, "")}`}>
																				{lead.customer_phone}
																		</a>
																</dd>
														</div>
														{lead.comment && (
																<div className={s.spec}>
																		<dt>Комментарий</dt>
																		<dd>{lead.comment}</dd>
																</div>
														)}
												</dl>
										</section>

										<section className={s.card}>
												<Text as="span" variant="subtitle">
														Комплектация на момент заявки
												</Text>
												<dl className={s.specs}>
														<div className={s.spec}>
																<dt>Модель</dt>
																<dd>{snapshot.product_name}</dd>
														</div>
														<div className={s.spec}>
																<dt>Артикул</dt>
																<dd>{snapshot.sku}</dd>
														</div>
														<div className={s.spec}>
																<dt>Размер</dt>
																<dd>{formatSizeMm(snapshot.width_mm, snapshot.height_mm)}</dd>
														</div>
														<div className={s.spec}>
																<dt>Цвет корпуса</dt>
																<dd>{snapshot.body_color.name}</dd>
														</div>
														<div className={s.spec}>
																<dt>Цвет панели</dt>
																<dd>{snapshot.panel_color.name}</dd>
														</div>
														<div className={s.spec}>
																<dt>Управление</dt>
																<dd>{snapshot.control_type.name}</dd>
														</div>
														<div className={s.spec}>
																<dt>Цена</dt>
																<dd>{formatPriceMinor(snapshot.price_minor, snapshot.currency)}</dd>
														</div>
												</dl>
										</section>

										<section className={s.card}>
												<Text as="span" variant="subtitle">
														История
												</Text>
												{lead.history.length === 0 ? (
														<p className={s.info}>Действий пока не было.</p>
												) : (
														<ul className={s.history}>
																{lead.history.map((entry) => (
																		<li key={entry.id} className={s.historyItem}>
                    <span className={s.historyAction}>
                      {HISTORY_ACTION_LABEL[entry.action] ?? entry.action}
												{entry.new_status && ` · ${LEAD_STATUS_LABEL[entry.new_status]}`}
                    </span>
																				<span className={s.historyMeta}>
                      {entry.actor?.name ?? "Система"} · {formatDate(entry.created_at)}
                    </span>
																				{entry.comment && (
																						<span className={s.historyComment}>{entry.comment}</span>
																				)}
																		</li>
																))}
														</ul>
												)}
										</section>
								</div>

								<aside className={s.actionsCol}>
										<section className={s.card}>
												<Text as="span" variant="subtitle">
														Ответственный сотрудник
												</Text>
												<p className={s.assignee}>
														{lead.assigned_to ? lead.assigned_to.name : "Заявка никому не назначена"}
												</p>

												<div className={s.actions}>
														{lead.status === "new" && !lead.assigned_to && (
																<Button
																		variant="ginger"
																		size="compact"
																		disabled={actionPending}
																		onClick={() => runAction(claim, undefined, "Заявка взята в работу")}
																		isLoading={claim.isPending}
																>
																		Взять в работу
																</Button>
														)}

														{canAssign && isOpen && (
																<form
																		className={s.actions}
																		onSubmit={(event) => {
																				event.preventDefault();
																				runAction(
																						assign,
																						{
																								userId: assigneeId.trim(),
																								comment,
																								expectedUpdatedAt: lead.updated_at,
																						},
																						"Ответственный назначен"
																				);
																		}}
																>
																		<Select
																				compact
																				label="Назначить сотрудника"
																				required
																				value={manualAssignee ? "manual" : assigneeId}
																				disabled={actionPending}
																				onChange={(event) => {
																						setManualAssignee(event.target.value === "manual");
																						setAssigneeId(event.target.value === "manual" ? "" : event.target.value);
																				}}
																		>
																				<option value="">Выберите сотрудника</option>
																				{assignees.map((employee) => (
																						<option value={employee.id} key={employee.id}>
																								{employee.name}
																								{employee.id === user.id ? " (вы)" : ""}
																						</option>
																				))}
																				<option value="manual">Другой сотрудник</option>
																		</Select>

																		{manualAssignee && (
																				<Input
																						compact
																						label="ID сотрудника"
																						required
																						pattern={UUID_PATTERN}
																						value={assigneeId}
																						disabled={actionPending}
																						onChange={(event) => setAssigneeId(event.target.value)}
																				/>
																		)}

																		<Button
																				type="submit"
																				variant="soft"
																				size="compact"
																				isLoading={assign.isPending && assign.variables?.userId !== null}
																				disabled={actionPending || !assigneeId || lead.assigned_to?.id === assigneeId}
																		>
																				Назначить
																		</Button>

																		{lead.assigned_to && (
																				<Button
																						variant="soft"
																						size="compact"
																						isLoading={assign.isPending && assign.variables?.userId === null}
																						disabled={actionPending}
																						onClick={() =>
																								runAction(
																										assign,
																										{userId: null, comment, expectedUpdatedAt: lead.updated_at},
																										"Назначение снято"
																								)
																						}
																				>
																						Снять назначение
																				</Button>
																		)}
																</form>
														)}
												</div>
										</section>

										{isOpen && canChangeStatus && (
												<section className={s.card}>
														<Text as="span" variant="subtitle">
																Изменение статуса
														</Text>

														<Textarea
																compact
																maxLength={1000}
																disabled={actionPending}
																id={commentId}
																label="Комментарий к действию"
																placeholder="Например: клиент подтвердил заказ"
																value={comment}
																onChange={(event) => setComment(event.target.value)}
																rows={3}
														/>

														<div className={s.actionButtons}>
																{lead.status === "in_progress" && (
																		<Button
																				isLoading={
																						changeStatus.isPending && changeStatus.variables?.status === "completed"
																				}
																				variant="ginger"
																				size="compact"
																				disabled={actionPending}
																				onClick={() =>
																						runAction(
																								changeStatus,
																								{
																										status: "completed",
																										comment,
																										expectedUpdatedAt: lead.updated_at,
																								},
																								"Заявка завершена"
																						)
																				}
																		>
																				Завершить
																		</Button>
																)}

																<Button
																		isLoading={
																				changeStatus.isPending && changeStatus.variables?.status === "cancelled"
																		}
																		variant="soft"
																		size="compact"
																		disabled={actionPending}
																		onClick={() =>
																				runAction(
																						changeStatus,
																						{
																								status: "cancelled",
																								comment,
																								expectedUpdatedAt: lead.updated_at,
																						},
																						"Заявка отклонена"
																				)
																		}
																>
																		Отклонить
																</Button>
														</div>
												</section>
										)}

										{isOpen && !canChangeStatus && (
												<p className={s.info}>Менеджер может менять статус только своей заявки.</p>
										)}
								</aside>
						</div>
				</div>
		);
}