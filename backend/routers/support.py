import uuid
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import SupportTicket, User
from ..auth import get_current_user

router = APIRouter(prefix="/api/support", tags=["support"])

@router.post("/tickets/create")
@router.post("/tickets")
async def create_ticket(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tid = req.get("id") or f"ticket-{uuid.uuid4().hex[:12]}"
    new_t = SupportTicket(
        id=tid,
        user_id=current_user.id,
        user_email=current_user.email,
        user_name=current_user.display_name,
        type=req.get("type", "General"),
        subject=req.get("subject", "Inquiry"),
        description=req.get("description", ""),
        status="Open",
        admin_response="",
        resolved_at=None,
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_t)
    db.commit()
    db.refresh(new_t)
    return {"data": {
        "id": new_t.id,
        "status": new_t.status
    }, "error": None}

@router.get("/tickets")
async def get_tickets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.is_admin:
        tickets = db.query(SupportTicket).order_by(SupportTicket.created_at.desc()).all()
    else:
        tickets = db.query(SupportTicket).filter(SupportTicket.user_id == current_user.id).all()
        
    res = []
    for t in tickets:
        res.append({
            "id": t.id,
            "userId": t.user_id,
            "userEmail": t.user_email,
            "userName": t.user_name,
            "type": t.type,
            "subject": t.subject,
            "description": t.description,
            "status": t.status,
            "adminResponse": t.admin_response,
            "resolvedAt": t.resolved_at,
            "createdAt": t.created_at
        })
    return {"data": res, "error": None}

@router.post("/tickets/resolve")
async def resolve_ticket(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
         raise HTTPException(status_code=403, detail="Forbidden")
         
    tid = req.get("id")
    reply = req.get("reply", "Resolved by admin support.")
    
    ticket = db.query(SupportTicket).filter(SupportTicket.id == tid).first()
    if ticket:
         ticket.status = "Resolved"
         ticket.admin_response = reply
         ticket.resolved_at = time.strftime('%Y-%m-%dT%H:%M:%SZ')
         db.commit()
    return {"data": True, "error": None}
