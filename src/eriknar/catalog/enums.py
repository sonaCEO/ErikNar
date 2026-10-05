from enum import StrEnum


class AvailabilityStatus(StrEnum):
    IN_STOCK = "in_stock"
    MADE_TO_ORDER = "made_to_order"
    OUT_OF_STOCK = "out_of_stock"
    HIDDEN = "hidden"
