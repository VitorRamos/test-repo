from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def apply_development_schema_updates(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    with engine.begin() as connection:
        if "availability" in tables:
            columns = {column["name"] for column in inspector.get_columns("availability")}
            for name, ddl in (
                ("start_date", "DATE"),
                ("end_date", "DATE"),
                ("days_of_week", "VARCHAR"),
            ):
                if name not in columns:
                    connection.execute(text(f"ALTER TABLE availability ADD COLUMN {name} {ddl}"))

        if "notifications" not in tables:
            connection.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS notifications (
                        id UUID PRIMARY KEY,
                        user_id UUID NOT NULL,
                        type VARCHAR NOT NULL,
                        title VARCHAR NOT NULL,
                        message VARCHAR NOT NULL,
                        lesson_id UUID,
                        read BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP
                    )
                    """
                )
            )
