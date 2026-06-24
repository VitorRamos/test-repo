from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_db, get_current_user
from backend.app.models.notification import Notification
from backend.app.models.user import User
from backend.app.schemas.notification import NotificationRead

router = APIRouter()


@router.get("/", response_model=list[NotificationRead])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.read.is_(False))
    notifications = query.order_by(Notification.created_at.desc()).limit(100).all()
    return notifications


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read.is_(False))
        .count()
    )
    return {"count": count}


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_read(
    notification_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification or notification.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    notification.read = True
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read.is_(False))
        .update({"read": True}, synchronize_session=False)
    )
    db.commit()
    return {"updated": updated}
