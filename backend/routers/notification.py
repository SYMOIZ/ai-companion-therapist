import uuid
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Notification, User
from ..auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("")
async def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notifs = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).all()
    res = []
    for n in notifs:
        res.append({
            "id": n.id,
            "userId": n.user_id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "isRead": bool(n.is_read),
            "createdAt": n.created_at
        })
    return {"data": res, "error": None}

@router.post("/mark-read")
async def mark_read(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    id = req.get("id")
    notif = db.query(Notification).filter(Notification.id == id, Notification.user_id == current_user.id).first()
    if notif:
        notif.is_read = 1
        db.commit()
    return {"data": True, "error": None}

@router.post("/create")
async def create_notification(req: dict, db: Session = Depends(get_db)):
    nid = req.get("id") or f"notif-{uuid.uuid4().hex[:12]}"
    new_notif = Notification(
        id=nid,
        user_id=req.get("userId") or req.get("user_id"),
        title=req.get("title", ""),
        message=req.get("message", ""),
        type=req.get("type", "system"),
        is_read=0,
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_notif)
    db.commit()
    return {"data": {"id": nid}, "error": None}
