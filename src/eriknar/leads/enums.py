from enum import StrEnum


class LeadSource(StrEnum):
    WEBSITE = "website"
    TELEGRAM = "telegram"


class LeadStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"
