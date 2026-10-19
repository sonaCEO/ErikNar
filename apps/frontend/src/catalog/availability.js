export const AvailabilityStatus = {
		IN_STOCK: "in_stock",
		MADE_TO_ORDER: "made_to_order",
		OUT_OF_STOCK: "out_of_stock",
		HIDDEN: "hidden",
};

export const availabilityLabel = {
		[AvailabilityStatus.IN_STOCK]: "В наличии",
		[AvailabilityStatus.MADE_TO_ORDER]: "Под заказ",
		[AvailabilityStatus.OUT_OF_STOCK]: "Нет в наличии",
};
