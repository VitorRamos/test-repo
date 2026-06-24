from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _ensure_columns(connection, table: str, definitions: dict[str, str], existing: set[str]) -> None:
    for name, ddl_type in definitions.items():
        if name not in existing:
            connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}"))


def apply_development_schema_updates(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    with engine.begin() as connection:
        if "availability" in tables:
            columns = {column["name"] for column in inspector.get_columns("availability")}
            _ensure_columns(
                connection,
                "availability",
                {
                    "start_date": "DATE",
                    "end_date": "DATE",
                    "days_of_week": "VARCHAR",
                },
                columns,
            )

        if "payments" in tables:
            columns = {column["name"] for column in inspector.get_columns("payments")}
            _ensure_columns(
                connection,
                "payments",
                {
                    "student_id": "UUID",
                    "instructor_id": "UUID",
                    "released_at": "TIMESTAMP",
                },
                columns,
            )
