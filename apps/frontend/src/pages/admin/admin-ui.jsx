import {useId} from "react";
import {AlertCircle} from "lucide-react";
import clsx from "clsx";
import {Modal} from "../../components/ui/modal/modal";
import {Title} from "../../components/ui/typography/title/title";
import {Button} from "../../components/ui/button/button";
import {Spinner} from "../../components/ui/spinner/spinner";
import s from "./admin.module.css";

export function RequestState({pending, error, onRetry, isFetching = false}) {
		if (!pending && !error) return null;
		if (pending && !error) {
				return (
						<div className={s.loading} role="status">
								<Spinner size={24}/>
								<span>Загрузка данных...</span>
						</div>
				);
		}
		return (
				<div className={s.empty} role={error ? "alert" : "status"}>
						<AlertCircle size={22}/>
						<p>{error?.message ?? "Загрузка данных..."}</p>
						{error && onRetry && (
								<Button size="compact" variant="soft" isLoading={isFetching} onClick={onRetry}>
										Повторить
								</Button>
						)}
				</div>
		);
}

export function EmptyState({children}) {
		return <div className={s.empty}>{children}</div>;
}

export function FormError({error}) {
		if (!error) return null;
		return (
				<p className={s.error} role="alert">
						{error.code === "concurrent_update"
								? "Данные уже изменены другим сотрудником. Загрузите актуальную версию перед повторным сохранением."
								: error.message ?? String(error)}
				</p>
		);
}

export function AdminDialog({title, children, onClose, busy = false}) {
		const titleId = useId();
		return (
				<Modal open onClose={() => !busy && onClose()} labelledBy={titleId} className={clsx(s.scope, s.dialog)}>
						<div id={titleId}>
								<Title level={2}>{title}</Title>
						</div>
						{children}
				</Modal>
		);
}

export function ConfirmDialog({title, children, onClose, onConfirm, pending, error, confirmLabel = "Подтвердить"}) {
		return (
				<AdminDialog title={title} onClose={onClose} busy={pending}>
						<p className={s.muted}>{children}</p>
						<FormError error={error}/>
						<div className={s.formFooter}>
								<Button size="compact" variant="soft" onClick={onClose} disabled={pending}>
										Отмена
								</Button>
								<Button size="compact" variant="black" onClick={onConfirm} isLoading={pending}>
										{confirmLabel}
								</Button>
						</div>
				</AdminDialog>
		);
}

export function Pagination({page, total, pageSize = 20, onChange, pending}) {
		const pages = Math.max(1, Math.ceil(total / pageSize));
		if (pages <= 1 && page === 1) return null;
		return (
				<nav className={s.pagination} aria-label="Страницы списка">
      <span>
        Страница {page} из {pages}
      </span>
						<Button
								size="compact"
								variant="soft"
								disabled={page <= 1 || pending}
								onClick={() => onChange(page - 1)}
						>
								Назад
						</Button>
						<Button
								size="compact"
								variant="soft"
								disabled={page >= pages || pending}
								onClick={() => onChange(page + 1)}
						>
								Вперёд
						</Button>
				</nav>
		);
}