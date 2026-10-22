import customImage from "../../../assets/custom/custom-img.jpg";

export const customMeta = {
		subtitle: "Индивидуальное производство",
		title: (
				<>
						Создадим модель, <strong>которой ещё нет</strong>
				</>
		),
		text: "Нужны особые размеры, форма или оттенок? Спроектируем и подготовим полотенцесушитель специально для вашего интерьера.",
		button: "Обсудить свою модель",
		image: {
				src: customImage,
				alt: "Эскиз индивидуальной модели полотенцесушителя",
				width: 1600,
				height: 1100,
		},
};

export const customSteps = [
		{
				id: "idea",
				number: "01",
				text: "Обсуждаем идею и размеры",
		},
		{
				id: "sketch",
				number: "02",
				text: "Готовим эскиз и расчёт",
		},
		{
				id: "produce",
				number: "03",
				text: "Производим и доставляем",
		},
];
