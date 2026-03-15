from pydantic import BaseModel


class InstructorCreate(BaseModel):
    name: str
    cpf: str
    detran_license: str
    price_per_hour: float
    city: str
    state: str


class InstructorRead(InstructorCreate):
    id: str
    rating: float