from uuid import UUID
from sqlalchemy.orm import Session

from backend.app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    user_id: UUID,
    type: str,
    title: str,
    message: str,
    lesson_id: UUID | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        lesson_id=lesson_id,
    )
    db.add(notification)
    db.flush()
    return notification
