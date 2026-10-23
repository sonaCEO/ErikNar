import {
		BrickWall,
		Droplet,
		Leaf,
		Link2,
		Scaling,
		ShieldCheck,
		Sparkle,
		Waves,
} from "lucide-react";

export const advantagesMeta = {
		subtitle: "Продумано до деталей",
		title: "Больше, чем просто тепло",
};

export const advantages = [
		{id: "energy", title: "Экономия электроэнергии", Icon: Leaf},
		{id: "overheat", title: "Защита от перегрева", Icon: ShieldCheck},
		{id: "coating", title: "Порошковое покрытие", Icon: Sparkle},
		{id: "mount", title: "Настенный монтаж", Icon: BrickWall},
		{id: "moisture", title: "Защита от влаги", Icon: Droplet},
		{id: "heat", title: "Равномерный прогрев", Icon: Waves},
		{id: "space", title: "Экономия пространства", Icon: Scaling},
		{id: "install", title: "Простая установка", Icon: Link2},
];
