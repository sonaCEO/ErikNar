import {StatusScreen} from "../../components/ui/status-screen/status-screen";

export function NotFound() {
		return (
				<StatusScreen
					code="404"
					subtitle="Страница не найдена"
					title={<>Здесь пусто, <strong>но тепло рядом</strong></>}
					text="Такого адреса нет. Вернитесь на главную - там каталог и всё нужное."
				/>
		);
}