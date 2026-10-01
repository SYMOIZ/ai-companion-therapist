import json
import uuid
import time
import traceback
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, TeamMember, Broadcast, SupportTicket, RiskAlert, SystemSetting, TherapistApplication, TherapistProfile, Notification, EmailEvent
from ..auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

def _require_admin(current_user: User):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")

def _record_pending_email(db: Session, to_email: str, subject: str, body: str, event_type: str):
    EmailEvent.__table__.create(bind=db.get_bind(), checkfirst=True)
    event = EmailEvent(
        id=f"email-{uuid.uuid4().hex[:12]}",
        to_email=to_email,
        subject=subject,
        body=body,
        event_type=event_type,
        status="pending",
        created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    db.add(event)
    return event

@router.post("/approve-therapist")
async def approve_therapist(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(current_user)
    app_id = req.get("appId")
    app = db.query(TherapistApplication).filter(TherapistApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if not app.user_id:
        raise HTTPException(status_code=400, detail="Application missing user_id")
    try:
        app.status = "approved"
        user = db.query(User).filter(User.id == app.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        user.account_status = "active"
        meta = user.metadata if isinstance(user.metadata, dict) else {}
        if isinstance(user.metadata, str):
            try:
                meta = json.loads(user.metadata)
            except Exception:
                meta = {}
        meta = dict(meta or {})
        meta["applicationStatus"] = "approved"
        user.metadata = meta
        profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == app.user_id).first()
        if not profile:
             profile = TherapistProfile(user_id=app.user_id, specialty=app.specialization, experience=app.years_experience, license_number=app.license_number, is_crisis_certified=0)
             db.add(profile)
        else:
             profile.specialty = app.specialization
             profile.experience = app.years_experience
             profile.license_number = app.license_number
        notif = Notification(id=f"notif-{uuid.uuid4().hex[:12]}", user_id=app.user_id, title='Congratulations! Application Approved 🎉', message='Welcome to Sukoon! Your therapist profile is now active.', type='system', created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ'))
        db.add(notif)
        _record_pending_email(
            db,
            user.email,
            "Your Sukoon therapist application was approved",
            "Your therapist application has been approved. Your account is now active. This message is queued for delivery and has not been sent.",
            "therapist_application_approved",
        )
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject-therapist")
async def reject_therapist(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(current_user)
    app_id = req.get("appId")
    reason = (req.get("reason") or "").strip()
    app = db.query(TherapistApplication).filter(TherapistApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    app.status = "rejected"
    user = db.query(User).filter(User.id == app.user_id).first() if app.user_id else None
    if user:
        user.account_status = "rejected"
        meta = user.metadata if isinstance(user.metadata, dict) else {}
        if isinstance(user.metadata, str):
            try:
                meta = json.loads(user.metadata)
            except Exception:
                meta = {}
        meta = dict(meta or {})
        meta["applicationStatus"] = "rejected"
        user.metadata = meta
    message = "Your therapist application was not approved."
    if reason:
        message = f"{message} Reason: {reason}"
    if app.user_id:
        db.add(Notification(
            id=f"notif-{uuid.uuid4().hex[:12]}",
            user_id=app.user_id,
            title="Application not approved",
            message=message,
            type="system",
            created_at=time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        ))
    if app.email:
        _record_pending_email(
            db,
            app.email,
            "Your Sukoon therapist application was not approved",
            message + " This message is queued for delivery and has not been sent.",
            "therapist_application_rejected",
        )
    db.commit()
    return {"status": "success"}

@router.post("/suspend-user")
async def suspend_user(req: dict, db: Session = Depends(get_db)):
    uid = req.get("userId")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.account_status = "suspended"
    db.commit()
    return {"status": "success"}

@router.post("/unsuspend-user")
async def unsuspend_user(req: dict, db: Session = Depends(get_db)):
    uid = req.get("userId")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.account_status = "active"
    db.commit()
    return {"status": "success"}

@router.get("/users")
async def get_admin_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
         raise HTTPException(status_code=403, detail="Forbidden")

    users_with_tickets = db.query(
        User, 
        func.count(SupportTicket.id).label('ticket_count')
    ).outerjoin(
        SupportTicket, User.id == SupportTicket.user_id
    ).group_by(User.id).all()

    res = []
    for u, ticket_count in users_with_tickets:
        res.append({
            "id": u.id,
            "display_name": u.display_name,
            "email": u.email,
            "role": u.role,
            "accountStatus": u.account_status,
            "age": u.age,
            "gender": u.gender,
            "region": u.region,
            "profession": u.profession,
            "preferredLanguage": u.preferred_language,
            "tonePreference": u.tone_preference,
            "ticketsCount": ticket_count,
            "suspensionReason": u.suspension_reason,
            "createdAt": u.created_at
        })
    return {"data": res, "error": None}

@router.post("/suspend")
async def suspend_user(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    uid = req.get("userId") or req.get("user_id")
    reason = req.get("reason", "Violated platform rules.")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.account_status = "suspended"
    user.suspension_reason = reason
    db.commit()
    return {"data": {"status": "suspended", "userId": uid}, "error": None}

@router.get("/team")
async def get_team(db: Session = Depends(get_db)):
    members = db.query(TeamMember).all()
    res = []
    for m in members:
        res.append({
            "id": m.id,
            "name": m.name,
            "email": m.email,
            "role": m.role,
            "status": m.status,
            "permissions": json.loads(m.permissions) if m.permissions else {},
            "accessExpiresAt": m.access_expires_at,
            "lastLogin": m.last_login,
            "createdAt": m.created_at
        })
    return {"data": res, "error": None}

@router.post("/team/add")
async def add_team_member(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    mid = f"team-{uuid.uuid4().hex[:12]}"
    new_m = TeamMember(
        id=mid,
        name=req.get("name"),
        email=req.get("email"),
        role=req.get("role", "Support"),
        status="Active",
        permissions=json.dumps(req.get("permissions", {})),
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_m)
    db.commit()
    return {"data": {"id": mid}, "error": None}

@router.post("/team/revoke")
async def revoke_team(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    mid = req.get("id")
    db.query(TeamMember).filter(TeamMember.id == mid).update({"status": "Revoked"})
    db.commit()
    return {"data": {"id": mid, "status": "Revoked"}, "error": None}

@router.post("/team/status")
async def change_team_status(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    mid = req.get("id")
    status_val = req.get("status")
    db.query(TeamMember).filter(TeamMember.id == mid).update({"status": status_val})
    db.commit()
    return {"data": {"id": mid, "status": status_val}, "error": None}

@router.post("/broadcast")
async def send_broadcast(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    bid = f"broad-{uuid.uuid4().hex[:12]}"
    new_b = Broadcast(
        id=bid,
        title=req.get("title"),
        message=req.get("message"),
        type=req.get("type", "announcement"),
        audience=req.get("audience", "all"),
        sent_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_b)
    db.commit()
    return {"data": {"id": bid}, "error": None}

@router.get("/broadcast/history")
async def get_broadcast_history(db: Session = Depends(get_db)):
    history = db.query(Broadcast).order_by(Broadcast.sent_at.desc()).all()
    res = []
    for b in history:
        res.append({
            "id": b.id,
            "title": b.title,
            "message": b.message,
            "type": b.type,
            "audience": b.audience,
            "sentAt": b.sent_at
        })
    return {"data": res, "error": None}

@router.get("/health")
async def get_health():
    return {"status": "healthy", "database": "connected", "services": {"gemini": "active", "rag": "active", "audio": "active"}}

@router.get("/monetization")
async def get_monetization_settings(db: Session = Depends(get_db)):
    configs = db.query(SystemSetting).all()
    res = {}
    for c in configs:
         res[c.key] = c.value
    return {
        "payout_split": float(res.get("payout_split", 0.85)),
        "commission_rate": float(res.get("commission_rate", 0.15)),
        "crisis_support_free": res.get("crisis_support_free", "true") == "true"
    }

@router.post("/monetization/update")
async def update_monetization(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
         raise HTTPException(status_code=403, detail="Forbidden")
    for k, v in req.items():
         rec = db.query(SystemSetting).filter(SystemSetting.key == k).first()
         if not rec:
              rec = SystemSetting(key=k, value=str(v))
              db.add(rec)
         else:
              rec.value = str(v)
    db.commit()
    return {"status": "updated"}
