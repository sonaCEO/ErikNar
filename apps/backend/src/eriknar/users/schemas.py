from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from eriknar.users.enums import UserRole


class LoginRequest(BaseModel):
    login: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    login: str
    role: UserRole
    is_active: bool
    telegram_user_id: int | None


class CreateEmployeeCommand(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    login: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=12, max_length=128)
    role: UserRole
    telegram_user_id: int | None = None


class UpdateEmployeeCommand(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    password: str | None = Field(default=None, min_length=12, max_length=128)
    role: UserRole | None = None
    is_active: bool | None = None
    telegram_user_id: int | None = None
