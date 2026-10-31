import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {useNavigate} from "react-router";
import {Plus, Pencil} from "lucide-react";
import {toast} from "sonner";
import clsx from "clsx";
import {createEmployee, updateEmployee} from "../../../api/admin/users";
import {useAuth} from "../../../auth/auth-context";
import {queryKeys} from "../../../hooks/queries/query-keys";
import {useEmployee, useEmployeePage} from "../../../hooks/queries/use-admin-users";
import {Badge} from "../../../components/ui/badge/badge";
import {Button} from "../../../components/ui/button/button";
import {Input} from "../../../components/ui/input/input";
import {Select} from "../../../components/ui/select/select";
import {Title} from "../../../components/ui/typography/title/title";
import {ConfirmDialog, EmptyState, FormError, Pagination, RequestState} from "../admin-ui";
import {employeeDraft, employeePayload} from "./employee-form";
import s from "../admin.module.css";

function EmployeeForm({mode, employeeId, onSaved, selfId}) {
		const employee = useEmployee(mode === "edit" ? employeeId : null);
		const [draft, setDraft] = useState(() => employeeDraft(mode));
		const [error, setError] = useState(null);
		const [confirmation, setConfirmation] = useState(null);
		const save = useMutation({
				mutationFn: ({id, body}) => mode === "create" ? createEmployee(body) : updateEmployee(id, body),
		});
		const field = (name) => ({
				value: draft[name],
				onChange: (event) => setDraft((previous) => ({...previous, [name]: event.target.value})),
		});

		async function persist(request) {
				setError(null);
				try {
						const result = await save.mutateAsync(request);
						setConfirmation(null);
						setDraft(employeeDraft(mode));
						await onSaved(result, request.body);
				} catch (err) {
						setError(err);
				}
		}

		function submit(event) {
				event.preventDefault();
				setError(null);
				try {
						const request = {id: employeeId, body: employeePayload(draft, mode)};
						if (mode === "edit" && (request.body.is_active === false || (request.id === selfId && request.body.role === "manager"))) {
								setConfirmation(request);
						} else {
								persist(request);
						}
				} catch (err) {
						setError(err);
				}
		}

		return (
				<>
						<form className={s.card} onSubmit={submit}>
								<Title level={3}>{mode === "create" ? "Новый сотрудник" : "Изменить сотрудника"}</Title>
								{mode === "edit" && employee.data && (
										<p className={s.hint}>
												{employee.data.name} · {employee.data.login}. Изменятся только заполненные поля.
										</p>
								)}
								{mode === "edit" && (
										<RequestState
												pending={employee.isPending}
												error={employee.error}
												onRetry={employee.refetch}
												isFetching={employee.isFetching}
										/>
								)}
								<fieldset className={s.grid} disabled={save.isPending || (mode === "edit" && !employee.data)}>
										<Input compact label="Имя сотрудника" required={mode === "create"} maxLength={120} {...field("name")} />
										{mode === "create" && (
												<Input compact label="Логин" required maxLength={120} autoComplete="off" {...field("login")} />
										)}
										<Input
												compact
												label={mode === "create" ? "Пароль" : "Новый пароль"}
												type="password"
												autoComplete="new-password"
												required={mode === "create"}
												minLength={12}
												maxLength={128}
												placeholder="От 12 до 128 символов"
												{...field("password")}
										/>
										<Select compact label="Роль" required={mode === "create"} {...field("role")}>
												{mode === "edit" && <option value="">Не менять</option>}
												<option value="manager">Менеджер</option>
												<option value="admin">Администратор</option>
										</Select>
										{mode === "edit" && (
												<Select compact label="Доступ к системе" {...field("is_active")}>
														<option value="">Не менять</option>
														<option value="true">Активировать</option>
														<option value="false">Отключить</option>
												</Select>
										)}
										{mode === "edit" && (
												<Select compact label="Привязка Telegram" {...field("telegram_action")}>
														<option value="keep">Не менять</option>
														<option value="set">Указать Telegram ID</option>
														<option value="clear">Отвязать</option>
												</Select>
										)}
										{draft.telegram_action === "set" && (
												<Input
														compact
														label="Telegram ID"
														inputMode="numeric"
														required={mode === "edit"}
														placeholder={mode === "create" ? "Необязательно" : "Числовой ID"}
														{...field("telegram_user_id")}
												/>
										)}
								</fieldset>
								<p className={s.hint}>
										Менеджеру доступны заявки. Администратору также доступны каталог и сотрудники. При смене пароля или
										роли сотруднику потребуется войти заново.
								</p>
								<FormError error={error}/>
								<div className={s.formFooter}>
										<Button type="submit" size="compact" variant="ginger" isLoading={save.isPending}>
												{mode === "create" ? <Plus size={15}/> : <Pencil size={15}/>}
												{mode === "create" ? "Создать сотрудника" : "Сохранить изменения"}
										</Button>
								</div>
						</form>
						{confirmation && (
								<ConfirmDialog
										title="Изменить доступ сотрудника?"
										confirmLabel="Изменить доступ"
										pending={save.isPending}
										error={error}
										onClose={() => setConfirmation(null)}
										onConfirm={() => persist(confirmation)}
								>
										Сотрудник потеряет текущий доступ к системе. Его заявки останутся назначенными ему. Если вы меняете
										собственный доступ, сначала убедитесь, что есть другой активный администратор.
								</ConfirmDialog>
						)}
				</>
		);
}

export function UsersPage() {
		const {user, logout} = useAuth();
		const navigate = useNavigate();
		const client = useQueryClient();
		const [page, setPage] = useState(1);
		const [editor, setEditor] = useState({mode: "create", id: null});
		const {data, isPending, error, isFetching, isPlaceholderData, refetch} = useEmployeePage(page);

		async function saved(result, body) {
				await client.invalidateQueries({queryKey: ["admin", "users"]});
				if (result.id === user.id) {
						if (body.password || (body.role && body.role !== user.role) || body.is_active === false) {
								logout();
								navigate("/admin/login", {replace: true});
								toast.success("Учётная запись обновлена. Войдите заново.");
								return;
						}
						client.setQueryData(queryKeys.me, result);
				}
				if (editor.mode === "edit" && body.name) {
						await client.invalidateQueries({queryKey: ["admin", "leads"]});
				}
				toast.success(editor.mode === "create" ? "Сотрудник создан" : "Сотрудник обновлён");
		}

		return (
				<div className={s.page}>
						<header className={s.header}>
								<div>
										<Title level={1}>Сотрудники</Title>
										<p className={s.muted}>
												Учётные записи, роли и привязка Telegram{data ? ` · Всего: ${data.total}` : ""}
										</p>
								</div>
								<Button
										size="compact"
										variant="ginger"
										active={editor.mode === "create"}
										onClick={() => setEditor({mode: "create", id: null})}
								>
										<Plus size={15}/> Добавить сотрудника
								</Button>
						</header>

						<RequestState pending={isPending} error={error} onRetry={refetch} isFetching={isFetching}/>

						{data && !error && (data.items.length ? (
								<div className={clsx(s.tableWrap, s.responsiveWrap, isPlaceholderData && s.dimmed)} aria-busy={isFetching}>
										<table className={clsx(s.table, s.responsiveTable)}>
												<thead>
												<tr>
														<th scope="col">Сотрудник</th>
														<th scope="col">Роль</th>
														<th scope="col">Доступ</th>
														<th scope="col">Действия</th>
												</tr>
												</thead>
												<tbody>
												{data.items.map((employee) => (
														<tr key={employee.id}>
																<td>
																		<span className={s.name}>
																				{employee.name}
																				{employee.id === user.id ? " (вы)" : ""}
																		</span>
																		<span className={s.subline}>{employee.login}</span>
																</td>
																<td data-label="Роль">{employee.role === "admin" ? "Администратор" : "Менеджер"}</td>
																<td data-label="Доступ">
																		<Badge variant={employee.is_active ? "in_stock" : "out_of_stock"}>
																				{employee.is_active ? "Активен" : "Отключён"}
																		</Badge>
																</td>
																<td>
																		<Button
																				size="compact"
																				variant="soft"
																				active={editor.mode === "edit" && editor.id === employee.id}
																				onClick={() => setEditor({mode: "edit", id: employee.id})}
																		>
																				<Pencil size={14}/> Изменить
																		</Button>
																</td>
														</tr>
												))}
												</tbody>
										</table>
								</div>
						) : (
								<EmptyState>
										<Title level={3}>Сотрудников пока нет</Title>
								</EmptyState>
						))}

						{data && <Pagination page={page} total={data.total} onChange={setPage} pending={isFetching}/>}

						{(editor.mode === "create" || editor.id) && (
								<EmployeeForm
										key={`${editor.mode}:${editor.id ?? "new"}`}
										mode={editor.mode}
										employeeId={editor.id}
										selfId={user.id}
										onSaved={saved}
								/>
						)}
				</div>
		);
}
