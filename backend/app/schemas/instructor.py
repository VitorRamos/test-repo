from pydantic import BaseModel, field_validator
from datetime import datetime
from uuid import UUID
import re


def normalize_cpf(value: str) -> str:
    return re.sub(r"\D", "", value)


def is_valid_cpf(value: str) -> bool:
    cpf = normalize_cpf(value)
    if len(cpf) != 11 or len(set(cpf)) == 1:
        return False

    total = sum(int(cpf[index]) * (10 - index) for index in range(9))
    digit = (total * 10) % 11
    if digit == 10:
        digit = 0
    if digit != int(cpf[9]):
        return False

    total = sum(int(cpf[index]) * (11 - index) for index in range(10))
    digit = (total * 10) % 11
    if digit == 10:
        digit = 0
    return digit == int(cpf[10])


class InstructorCreate(BaseModel):
    name: str
    cpf: str
    detran_license: str
    price_per_hour: float
    city: str
    state: str
    bio: str | None = None

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str) -> str:
        cpf = normalize_cpf(value)
        if not is_valid_cpf(cpf):
            raise ValueError("CPF invalido")
        return cpf

    @field_validator("detran_license")
    @classmethod
    def validate_detran_license(cls, value: str) -> str:
        normalized = re.sub(r"[^A-Za-z0-9]", "", value).upper()
        if not re.fullmatch(r"[A-Z0-9]{6,20}", normalized):
            raise ValueError("Licenca DETRAN invalida")
        return normalized

    @field_validator("price_per_hour")
    @classmethod
    def validate_price_per_hour(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Preco por hora deve ser maior que zero")
        return value

    @field_validator("state")
    @classmethod
    def validate_state(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not re.fullmatch(r"[A-Z]{2}", normalized):
            raise ValueError("Estado deve ter 2 letras")
        return normalized


class InstructorRead(InstructorCreate):
    id: UUID
    user_id: UUID
    rating: float
    total_lessons: int
    created_at: datetime
    active: bool

    class Config:
        from_attributes = True
