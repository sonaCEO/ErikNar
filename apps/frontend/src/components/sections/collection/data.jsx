import productImage from "../../../assets/product/product-img.jpg";
import {AvailabilityStatus} from "../../../catalog/availability";

export const PAGE_SIZE = 10;

const collectionImage = {
		src: productImage,
		alt: "Полотенцесушитель ErikNar",
		width: 1024,
		height: 1024,
};

export const collectionMeta = {
		subtitle: "Коллекция",
		title: <>Выберите свою <strong>форму</strong> тепла</>,
		text: "Каждая модель комплектуется крючками, креплениями и выбранной панелью управления.",
};

export const collectionTabs = [
		{id: "all", label: "Все модели"},
		{id: "group", label: "Групповой"},
		{id: "ladder", label: "Лесенка"},
		{id: "vertical", label: "Вертикальная"},
];

const colors = [
		{id: "black", name: "Чёрный матовый", hex: "#282824"},
		{id: "graphite", name: "Графит", hex: "#6b645c"},
		{id: "mist", name: "Туман", hex: "#c9c5bb"},
		{id: "cream", name: "Кремовый", hex: "#fffdf8"},
		{id: "copper", name: "Медный", hex: "#a98455"},
];

const sizes = ["800×400", "1000×500", "1200×500"];

function formatPrice(value) {
		return `${value.toLocaleString("ru-RU")} ₽`;
}

const catalogSeed = [
		{
				type: "group",
				name: "Групповой",
				price: 12600,
				description: "Секции собраны группами, больше полотенец, спокойный ритм линий.",
		},
		{
				type: "ladder",
				name: "Лесенка",
				price: 9800,
				description: "Классическая лесенка с ровным шагом перекладин для ежедневного тепла.",
		},
		{
				type: "vertical",
				name: "Вертикальная Slim",
				price: 11200,
				description: "Узкий вертикальный профиль, туда, где важны сантиметры стены.",
		},
		{
				type: "vertical",
				name: "Вертикальная рамка",
				price: 13400,
				description: "Рамная конструкция с акцентом на геометрию и чистый силуэт.",
		},
		{
				type: "group",
				name: "Групповой Wide",
				price: 14800,
				description: "Широкие группы перекладин, максимум сушки при спокойном фасаде.",
		},
		{
				type: "ladder",
				name: "Лесенка Compact",
				price: 8900,
				description: "Компактная лесенка для небольших ванных без потери мощности.",
		},
		{
				type: "ladder",
				name: "Лесенка High",
				price: 12100,
				description: "Вытянутая лесенка, больше ярусов и визуальная вертикаль.",
		},
		{
				type: "group",
				name: "Групповой Duo",
				price: 13900,
				description: "Две плотные группы, баланс ёмкости и воздуха между секциями.",
		},
		{
				type: "vertical",
				name: "Вертикальная Line",
				price: 10500,
				description: "Тонкие вертикальные линии для минималистичных интерьеров.",
		},
		{
				type: "group",
				name: "Групповой Soft",
				price: 12900,
				description: "Мягкий ритм групп, когда сушилка должна быть незаметной.",
		},
		{
				type: "ladder",
				name: "Лесенка Pro",
				price: 15600,
				description: "Усиленная лесенка с увеличенным шагом под крупные полотенца.",
		},
		{
				type: "vertical",
				name: "Вертикальная Frame+",
				price: 16200,
				description: "Рамка с акцентной пропорцией, акцент стены, а не просто прибор.",
		},
];

const availabilityCycle = [
		AvailabilityStatus.IN_STOCK,
		AvailabilityStatus.IN_STOCK,
		AvailabilityStatus.MADE_TO_ORDER,
		AvailabilityStatus.OUT_OF_STOCK,
];

export const collectionProducts = catalogSeed.map((item, index) => ({
		id: String(index + 1),
		type: item.type,
		name: item.name,
		priceFrom: formatPrice(item.price),
		description: item.description,
		colors,
		sizes,
		availabilityStatus: availabilityCycle[index % availabilityCycle.length],
		image: collectionImage,
}));
