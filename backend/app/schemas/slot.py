from pydantic import BaseModel


class AvailableDayRead(BaseModel):
    date: str
    slots: list[str]
