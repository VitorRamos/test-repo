"""Unit tests for CPF validation helpers and instructor schema."""

import pytest
from pydantic import ValidationError

from backend.app.schemas.instructor import InstructorCreate, is_valid_cpf, normalize_cpf


def test_normalize_cpf_strips_non_digits():
    assert normalize_cpf("529.982.247-25") == "52998224725"


@pytest.mark.parametrize(
    "cpf,expected",
    [
        ("52998224725", True),
        ("11111111111", False),
        ("12345678901", False),
        ("5299822472", False),
        ("", False),
    ],
)
def test_is_valid_cpf(cpf, expected):
    assert is_valid_cpf(cpf) is expected


def test_instructor_create_accepts_valid_cpf():
    data = InstructorCreate(
        name="Instrutor",
        cpf="529.982.247-25",
        detran_license="abc123456",
        price_per_hour=80,
        city="São Paulo",
        state="sp",
    )
    assert data.cpf == "52998224725"
    assert data.detran_license == "ABC123456"
    assert data.state == "SP"


def test_instructor_create_rejects_invalid_cpf():
    with pytest.raises(ValidationError):
        InstructorCreate(
            name="Instrutor",
            cpf="12345678901",
            detran_license="ABC123456",
            price_per_hour=80,
            city="São Paulo",
            state="SP",
        )


def test_instructor_create_rejects_non_positive_price():
    with pytest.raises(ValidationError):
        InstructorCreate(
            name="Instrutor",
            cpf="52998224725",
            detran_license="ABC123456",
            price_per_hour=0,
            city="São Paulo",
            state="SP",
        )
