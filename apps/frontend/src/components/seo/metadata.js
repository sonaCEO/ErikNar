const titles = {
		home: "Электрические полотенцесушители ErikNar",
		login: "Вход в панель управления - ErikNar",
		admin: "Панель управления - ErikNar",
		notFound: "Страница не найдена - ErikNar",
		error: "Ошибка - ErikNar",
};

const description = "Каталог электрических полотенцесушителей ErikNar. Выберите модель, размер, цвет корпуса и панель управления.";

export const OG_IMAGE_PATH = "/og-image.jpg";

export function getSiteOrigin(value) {
		try {
				const url = new URL(value);
				if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
		} catch {
				return undefined;
		}
		return undefined;
}

export function getPageMetadata(page, origin) {
		const title = titles[page] ?? titles.notFound;
		const meta = [{name: "robots", content: page === "home" ? "index, follow" : "noindex, nofollow"}];
		const link = [];
		const metadata = {title, meta, link};
		if (page !== "home") return metadata;
		const siteOrigin = getSiteOrigin(origin);
		const image = siteOrigin ? `${siteOrigin}${OG_IMAGE_PATH}` : OG_IMAGE_PATH;

		meta.push(
				{name: "description", content: description},
				{property: "og:type", content: "website"},
				{property: "og:site_name", content: "ErikNar"},
				{property: "og:locale", content: "ru_RU"},
				{property: "og:title", content: title},
				{property: "og:description", content: description},
				{name: "twitter:card", content: "summary_large_image"},
				{name: "twitter:title", content: title},
				{name: "twitter:description", content: description},
				{property: "og:image", content: image},
				{property: "og:image:type", content: "image/jpeg"},
				{property: "og:image:width", content: "1200"},
				{property: "og:image:height", content: "630"},
				{property: "og:image:alt", content: "Логотип ErikNar"},
				{name: "twitter:image", content: image},
				{name: "twitter:image:alt", content: "Логотип ErikNar"},
		);
		if (siteOrigin) {
				const canonical = `${siteOrigin}/`;
				link.push({rel: "canonical", href: canonical});
				meta.push({property: "og:url", content: canonical});
		}
		return metadata;
}
