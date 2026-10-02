import json
import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import ChatSession, ChatMessage, DirectMessage, TherapyNote, SessionRating, SafetyIncident, UserFeedback, BugReport, RiskAlert, User, FollowupConversation, PaidChatSupport, TherapistConnection
from ..auth import get_current_user

router = APIRouter(prefix="/api/chats", tags=["chats"])

@router.get("/sessions")
async def get_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()
    res = []
    for s in sessions:
        res.append({
            "id": s.id,
            "userId": s.user_id,
            "mood": s.mood,
            "createdAt": s.created_at,
            "updatedAt": s.updated_at
        })
    return {"data": res, "error": None}

@router.post("/sessions/create")
async def create_session(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sid = data.get("id") or f"sess-{uuid.uuid4().hex[:12]}"
    new_sess = ChatSession(
        id=sid,
        user_id=current_user.id,
        mood=data.get("mood", "Neutral"),
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        updated_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_sess)
    db.commit()
    db.refresh(new_sess)
    return {"data": {
        "id": new_sess.id,
        "userId": new_sess.user_id,
        "mood": new_sess.mood,
        "createdAt": new_sess.created_at
    }, "error": None}

@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    msgs = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    res = []
    for m in msgs:
        res.append({
            "id": m.id,
            "sessionId": m.session_id,
            "userId": m.user_id,
            "role": m.role,
            "content": m.content,
            "metadata": json.loads(m.meta_data) if m.meta_data else {},
            "createdAt": m.created_at
        })
    return {"data": res, "error": None}

@router.post("/messages/create")
async def create_message(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    mid = data.get("id") or f"msg-{uuid.uuid4().hex[:12]}"
    session_id = data.get("sessionId") or data.get("session_id")
    
    # Check if session exists, else auto-create
    sess = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not sess:
        sess = ChatSession(
            id=session_id,
            user_id=current_user.id,
            mood="Neutral",
            created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            updated_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
        )
        db.add(sess)
        db.commit()
        
    meta = data.get("metadata") or {}
    new_msg = ChatMessage(
        id=mid,
        session_id=session_id,
        user_id=current_user.id,
        role=data.get("role", "user"),
        content=data.get("content", ""),
        meta_data=json.dumps(meta),
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    return {"data": {
        "id": new_msg.id,
        "sessionId": new_msg.session_id,
        "userId": new_msg.user_id,
        "role": new_msg.role,
        "content": new_msg.content,
        "metadata": meta,
        "createdAt": new_msg.created_at
    }, "error": None}

@router.post("/rate")
async def rate_session(data: dict, db: Session = Depends(get_db)):
    rid = f"rate-{uuid.uuid4().hex[:12]}"
    new_rating = SessionRating(
        id=rid,
        session_id=data.get("session_id") or data.get("sessionId"),
        rating=int(data.get("rating", 5)),
        remark=data.get("remark", ""),
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_rating)
    db.commit()
    return {"data": {"id": rid}, "error": None}

@router.post("/incidents")
async def report_incident(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    iid = f"inc-{uuid.uuid4().hex[:12]}"
    new_inc = SafetyIncident(
        id=iid,
        therapist_id=current_user.id,
        client_name=data.get("client_name") or data.get("clientName", "Anonymous"),
        incident_type=data.get("incident_type") or data.get("incidentType", "Behavioral"),
        description=data.get("description", ""),
        time_of_incident=data.get("time_of_incident") or data.get("timeOfIncident") or time.strftime('%Y-%m-%d %H:%M'),
        status="Reported",
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_inc)
    db.commit()
    return {"data": {"id": iid, "status": "Reported"}, "error": None}

@router.get("/direct")
async def get_direct_messages(otherUserId: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    uid = current_user.id
    msgs = db.query(DirectMessage).filter(
        ((DirectMessage.sender_id == uid) & (DirectMessage.receiver_id == otherUserId)) |
        ((DirectMessage.sender_id == otherUserId) & (DirectMessage.receiver_id == uid))
    ).order_by(DirectMessage.created_at.asc()).all()
    
    res = []
    for m in msgs:
        res.append({
            "id": m.id,
            "senderId": m.sender_id,
            "receiverId": m.receiver_id,
            "content": m.content,
            "createdAt": m.created_at
        })
    return {"data": res, "error": None}

@router.post("/direct/send")
async def send_direct_message(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sender_id = current_user.id
    receiver_id = data.get("receiverId") or data.get("receiver_id")
    content = data.get("content", "")
    
    receiver = db.query(User).filter(User.id == receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found.")
        
    current_time = time.strftime('%Y-%m-%dT%H:%M:%SZ')
    
    # Identify client and therapist
    is_sender_therapist = (current_user.role == "therapist")
    therapist_id = sender_id if is_sender_therapist else receiver_id
    client_id = receiver_id if is_sender_therapist else sender_id
    
    # 1. Check for Active Therapist Connection
    active_conn = db.query(TherapistConnection).filter(
        TherapistConnection.client_id == client_id,
        TherapistConnection.therapist_id == therapist_id,
        TherapistConnection.status == "active"
    ).first()
    
    is_conn_valid = False
    if active_conn:
        if not active_conn.chat_expires_at:
            is_conn_valid = True
        elif active_conn.chat_expires_at >= current_time:
            is_conn_valid = True
            
    # 2. Check for Paid Chat Support
    paid_support = db.query(PaidChatSupport).filter(
        PaidChatSupport.patient_id == client_id,
        PaidChatSupport.therapist_id == therapist_id,
        PaidChatSupport.expires_at >= current_time
    ).first()
    
    # 3. Check for Active Follow-up Conversation
    followup_conv = db.query(FollowupConversation).filter(
        FollowupConversation.patient_id == client_id,
        FollowupConversation.therapist_id == therapist_id,
        FollowupConversation.followup_expiry_date >= current_time
    ).first()
    
    # Enforce Client Sender Rules
    if not is_sender_therapist:
        if paid_support:
            # Paid chat support is active - no limits
            pass
        elif followup_conv:
            # Client has follow-up limit
            if followup_conv.message_count >= 10:
                raise HTTPException(
                    status_code=403, 
                    detail="Follow-up limit reached. Purchase chat support or a therapy session to continue."
                )
            # Increment follow-up message counter
            followup_conv.message_count += 1
            followup_conv.last_message_at = current_time
        elif is_conn_valid:
            # Active connection is valid
            pass
        else:
            raise HTTPException(
                status_code=403,
                detail="You do not have an active session or follow-up with this therapist. Please book a session or purchase chat support."
            )
            
    # Enforce Therapist Sender Rules
    else:
        if not (is_conn_valid or paid_support or followup_conv):
            raise HTTPException(
                status_code=403,
                detail="Therapist-patient relationship has expired. You cannot message this patient."
            )
            
    mid = f"dm-{uuid.uuid4().hex[:12]}"
    new_dm = DirectMessage(
        id=mid,
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        created_at=current_time
    )
    db.add(new_dm)
    db.commit()
    db.refresh(new_dm)
    
    return {"data": {
        "id": new_dm.id,
        "senderId": new_dm.sender_id,
        "receiverId": new_dm.receiver_id,
        "content": new_dm.content,
        "createdAt": new_dm.created_at
    }, "error": None}

@router.get("/notes")
async def get_notes(clientId: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(TherapyNote)
    if current_user.role == "therapist":
        query = query.filter(TherapyNote.therapist_id == current_user.id)
        if clientId:
            query = query.filter(TherapyNote.user_id == clientId)
    else:
        query = query.filter(TherapyNote.user_id == current_user.id)
        
    notes = query.order_by(TherapyNote.created_at.desc()).all()
    res = []
    for n in notes:
        res.append({
            "id": n.id,
            "userId": n.user_id,
            "therapistId": n.therapist_id,
            "title": n.title,
            "details": n.details,
            "markType": n.mark_type,
            "dateOfNote": n.date_of_note,
            "nextReminder": n.next_reminder,
            "createdAt": n.created_at
        })
    return {"data": res, "error": None}

@router.post("/notes/create")
async def create_note(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    nid = data.get("id") or f"note-{uuid.uuid4().hex[:12]}"
    new_note = TherapyNote(
        id=nid,
        user_id=data.get("userId") or data.get("user_id"),
        therapist_id=current_user.id,
        title=data.get("title", ""),
        details=data.get("details", ""),
        mark_type=data.get("markType") or data.get("mark_type", "Standard"),
        date_of_note=data.get("dateOfNote") or data.get("date_of_note") or time.strftime('%Y-%m-%d'),
        next_reminder=data.get("nextReminder") or data.get("next_reminder") or "",
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return {"data": {
        "id": new_note.id,
        "title": new_note.title
    }, "error": None}

@router.post("/feedback")
async def post_feedback(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fid = f"fed-{uuid.uuid4().hex[:12]}"
    new_feed = UserFeedback(
        id=fid,
        user_id=current_user.id,
        feedback_type=req.get("feedback_type") or req.get("feedbackType", "general"),
        category=req.get("category", "UI"),
        note=req.get("note", ""),
        status="Pending",
        meta_data=json.dumps(req.get("metadata", {})),
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_feed)
    db.commit()
    return {"data": {"id": fid, "status": "Pending"}, "error": None}

@router.get("/feedback")
async def get_feedback_admin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    feeds = db.query(UserFeedback).order_by(UserFeedback.created_at.desc()).all()
    res = []
    for f in feeds:
        client = db.query(User).filter(User.id == f.user_id).first()
        res.append({
            "id": f.id,
            "clientId": f.user_id,
            "clientName": client.display_name if client else "Anonymous Client",
            "feedbackType": f.feedback_type,
            "category": f.category,
            "note": f.note,
            "status": f.status,
            "metadata": json.loads(f.meta_data) if f.meta_data else {},
            "createdAt": f.created_at
        })
    return {"data": res, "error": None}

@router.post("/feedback/status")
async def update_feedback_status(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    fid = req.get("id")
    status_val = req.get("status")
    note_val = req.get("note", "")
    
    feed = db.query(UserFeedback).filter(UserFeedback.id == fid).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feedback not found")
        
    feed.status = status_val
    if note_val:
        # append note (stored inside metadata or status block)
        meta_dict = json.loads(feed.meta_data) if feed.meta_data else {}
        meta_dict["admin_note"] = note_val
        feed.meta_data = json.dumps(meta_dict)
        
    db.commit()
    return {"data": {"id": fid, "status": status_val}, "error": None}

@router.post("/bugs")
async def post_bug(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bid = f"bug-{uuid.uuid4().hex[:12]}"
    new_bug = BugReport(
        id=bid,
        user_id=current_user.id,
        session_id=req.get("session_id") or req.get("sessionId"),
        issue_type=req.get("issue_type") or req.get("issueType", "Technical"),
        description=req.get("description", ""),
        device_info=req.get("device_info") or req.get("deviceInfo", "web"),
        status="new",
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_bug)
    db.commit()
    return {"data": {"id": bid, "status": "new"}, "error": None}

@router.get("/bugs")
async def get_bugs_admin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    bugs = db.query(BugReport).order_by(BugReport.created_at.desc()).all()
    res = []
    for b in bugs:
        client = db.query(User).filter(User.id == b.user_id).first()
        res.append({
            "id": b.id,
            "userId": b.user_id,
            "userName": client.display_name if client else "Anonymous Client",
            "sessionId": b.session_id,
            "issueType": b.issue_type,
            "description": b.description,
            "deviceInfo": b.device_info,
            "status": b.status,
            "createdAt": b.created_at
        })
    return {"data": res, "error": None}

@router.post("/alerts")
async def post_alert(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    aid = f"alrt-{uuid.uuid4().hex[:12]}"
    new_alert = RiskAlert(
        id=aid,
        user_id=current_user.id,
        client_name=req.get("client_name") or current_user.display_name,
        trigger_keyword=req.get("trigger_keyword") or req.get("triggerKeyword", "unspecified"),
        message=req.get("message", "High stress detected"),
        detected_at=time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        status="Active"
    )
    db.add(new_alert)
    db.commit()
    return {"data": {"id": aid, "status": "Active"}, "error": None}

@router.get("/alerts")
async def get_alerts_admin(db: Session = Depends(get_db)):
    alerts = db.query(RiskAlert).order_by(RiskAlert.detected_at.desc()).all()
    res = []
    for a in alerts:
        res.append({
            "id": a.id,
            "userId": a.user_id,
            "clientName": a.client_name,
            "triggerKeyword": a.trigger_keyword,
            "message": a.message,
            "detectedAt": a.detected_at,
            "status": a.status
        })
    return {"data": res, "error": None}
