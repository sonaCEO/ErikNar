import bathroom from "../../../assets/spaces/bathroom.jpg";
import hallway from "../../../assets/spaces/hallway.jpg";
import laundry from "../../../assets/spaces/laundry.jpg";
import kitchen from "../../../assets/spaces/kitchen.jpg";

export const spacesMeta = {
		subtitle: "В любом пространстве",
		title: "Тепло там, где оно нужно",
};

export const spaces = [
		{
				id: "bathroom",
				number: "01",
				title: "Ванная комната",
				text: "Сухие полотенца и комфортный микроклимат каждый день",
				image: {
						src: bathroom,
						alt: "Полотенцесушитель в ванной комнате",
						width: 1200,
						height: 1500,
				},
		},
		{
				id: "hallway",
				number: "03",
				title: "Прихожая",
				text: "Для верхней одежды и обуви в непогоду",
				image: {
						src: hallway,
						alt: "Тёплая прихожая с местом для верхней одежды",
						width: 800,
						height: 1600,
				},
		},
		{
				id: "laundry",
				number: "02",
				title: "Постирочная",
				text: "Быстрая сушка вещей без лишней влажности",
				image: {
						src: laundry,
						alt: "Постирочная с сушкой белья",
						width: 1200,
						height: 900,
				},
		},
		{
				id: "kitchen",
				number: "04",
				title: "Кухня",
				text: "Компактное тепло для текстиля и уюта",
				image: {
						src: kitchen,
						alt: "Кухня с компактным источником тепла",
						width: 1200,
						height: 900,
				},
		},
];
