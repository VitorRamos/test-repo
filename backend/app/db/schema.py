from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def apply_development_schema_updates(engine: Engine) -> None:
    inspector = inspect(engine)
    if "availability" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("availability")}

    with engine.begin() as connection:
        if "start_date" not in columns:
            connection.execute(text("ALTER TABLE availability ADD COLUMN start_date DATE"))
        if "end_date" not in columns:
            connection.execute(text("ALTER TABLE availability ADD COLUMN end_date DATE"))
        if "days_of_week" not in columns:
            connection.execute(text("ALTER TABLE availability ADD COLUMN days_of_week VARCHAR"))
