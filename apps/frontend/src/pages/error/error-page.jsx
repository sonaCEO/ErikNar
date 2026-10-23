import {isRouteErrorResponse, useRouteError} from "react-router";
import Header from "../../components/global/header/header";
import {StatusScreen} from "../../components/ui/status-screen/status-screen";
import {Seo} from "../../components/seo/seo";
import {ModalProvider} from "../../components/modals/modal-provider";

function getErrorContent(error) {
		if (isRouteErrorResponse(error)) {
				if (error.status === 404) {
						return {
								code: "404",
								subtitle: "Страница не найдена",
								title: <>Здесь пусто, <strong>но тепло</strong> рядом</>,
								text: "Такого адреса нет. Вернитесь на главную - там каталог и всё нужное.",
								showReload: false,
						};
				}

				return {
						code: String(error.status),
						subtitle: "Ошибка",
						title: <>Что-то <strong>пошло не так</strong></>,
						text: error.statusText || "Не удалось открыть страницу. Попробуйте ещё раз.",
						showReload: true,
				};
		}

		return {
				code: "500",
				subtitle: "Сбой",
				title: <>Что-то <strong>пошло не так</strong></>,
				text: "Произошла непредвиденная ошибка. Обновите страницу или вернитесь на главную.",
				showReload: true,
		};
}

export function ErrorPage() {
		const error = useRouteError();
		const content = getErrorContent(error);

		return (
				<ModalProvider>
						<Seo page={content.code === "404" ? "notFound" : "error"}/>
						<Header/>
						<main>
								<StatusScreen {...content} />
						</main>
				</ModalProvider>
		);
}
