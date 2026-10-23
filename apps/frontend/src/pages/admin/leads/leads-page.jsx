import {useState} from "react";
import {Link} from "react-router";
import {RefreshCw} from "lucide-react";
import clsx from "clsx";
import {useAdminLeads} from "../../../hooks/queries/use-admin-leads";
import {Badge} from "../../../components/ui/badge/badge";
import {Button} from "../../../components/ui/button/button";
import {useAuth} from "../../../auth/auth-context";
import {RequestState} from "../admin-ui";
import {Title} from "../../../components/ui/typography/title/title";
import {formatPriceMinor} from "../../../utils/format";
import {LEAD_STATUS_LABEL, LEAD_STATUS_BADGE_VARIANT} from "./lead-status";
import s from "./leads-page.module.css";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
		{value: undefined, label: "Все"},
		{value: "new", label: "Новые"},
		{value: "in_progress", label: "В работе"},
		{value: "completed", label: "Завершённые"},
		{value: "cancelled", label: "Отклонённые"},
];

function formatLeadNumber(number) {
		return `№${String(number).padStart(4, "0")}`;
}

function formatDate(iso) {
		return new Date(iso).toLocaleString("ru-RU", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
		});
}

export function LeadsPage() {
		const {user} = useAuth();
		const [status, setStatus] = useState(undefined);
		const [unassignedOnly, setUnassignedOnly] = useState(false);
		const [ownOnly, setOwnOnly] = useState(false);
		const [page, setPage] = useState(1);

		const filters = {
				page,
				pageSize: PAGE_SIZE,
				status,
				unassigned: unassignedOnly || undefined,
				assignedToUserId: ownOnly ? user.id : undefined,
		};
		const {data, isPending, isError, error, isPlaceholderData, isFetching, refetch} = useAdminLeads(filters);

		const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

		function selectStatus(next) {
				setStatus(next);
				setPage(1);
		}

		function toggleUnassigned() {
				setUnassignedOnly((prev) => !prev);
				setOwnOnly(false);
				setPage(1);
		}

		return (
				<div className={s.page}>
						<header className={s.header}>
								<div>
										<Title level={1}>Заявки</Title>
										<p className={s.info}>Обращения клиентов с сайта и из
												Telegram{data ? ` · Найдено: ${data.total}` : ""}</p>
								</div>
								<Button variant="soft" size="compact" isLoading={isFetching} onClick={() => refetch()}>
										<RefreshCw size={14}/> Обновить
								</Button>
						</header>

						<div className={s.filters}>
								<div className={s.tabs} role="group" aria-label="Фильтр по статусу">
										{STATUS_FILTERS.map((filter) => (
												<Button
														key={filter.label}
														variant="soft"
														size="compact"
														active={status === filter.value}
														aria-pressed={status === filter.value}
														onClick={() => selectStatus(filter.value)}
												>
														{filter.label}
												</Button>
										))}
								</div>
								<Button
										variant="soft"
										size="compact"
										active={unassignedOnly}
										aria-pressed={unassignedOnly}
										onClick={toggleUnassigned}
								>
										Без ответственного
								</Button>
								<Button variant="soft" size="compact" active={ownOnly} aria-pressed={ownOnly} onClick={() => {
										setOwnOnly(!ownOnly);
										setUnassignedOnly(false);
										setPage(1);
								}}>Мои заявки</Button>
						</div>

						{isPending && <RequestState pending/>}

						{isError && (
								<p className={s.error} role="alert">
										{error?.message ?? "Не удалось загрузить заявки"}
								</p>
						)}

						{data && data.items.length === 0 && (
								<p className={s.info}>Заявок с такими фильтрами нет.</p>
						)}

						{data && data.items.length > 0 && (
								<>
										<ul className={clsx(s.list, isPlaceholderData && s.dimmed)}>
												{data.items.map((lead) => (
														<li key={lead.id}>
																<Link
																		className={s.row}
																		to={`/admin/leads/${lead.id}`}
																>
																		<span className={s.cellNumber}>{formatLeadNumber(lead.number)}</span>
																		<span className={s.cellCustomer}>
																				<span className={s.name}>{lead.customer_name}</span>
																				<span className={s.phone}>{lead.customer_phone}</span>
																		</span>
																		<span className={s.cellProduct}>
																				{lead.snapshot.product_name}
																				<span className={s.price}>
																						{formatPriceMinor(lead.snapshot.price_minor, lead.snapshot.currency)}
																				</span>
																		</span>
																		<span className={s.cellAssignee}>
																				{lead.assigned_to ? lead.assigned_to.name : "—"}
																		</span>
																		<span className={s.cellDate}>{formatDate(lead.created_at)}</span>
																		<Badge variant={LEAD_STATUS_BADGE_VARIANT[lead.status]}>
																				{LEAD_STATUS_LABEL[lead.status]}
																		</Badge>
																</Link>
														</li>
												))}
										</ul>

										{totalPages > 1 && (
												<div className={s.pagination}>
														<Button
																variant="soft"
																size="compact"
																disabled={page <= 1 || isPlaceholderData}
																onClick={() => setPage((prev) => prev - 1)}
														>
																Назад
														</Button>
														<span className={s.pageInfo}>{page} / {totalPages}</span>
														<Button
																variant="soft"
																size="compact"
																disabled={page >= totalPages || isPlaceholderData}
																onClick={() => setPage((prev) => prev + 1)}
														>
																Вперёд
														</Button>
												</div>
										)}
								</>
						)}
				</div>
		);
}
