import json
import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, TherapistProfile, TherapistConnection, TherapistApplication, CalendarSlot, TherapistBoost, TherapistSubscription, Review, FollowupConversation, FollowupRequest, PaidChatSupport, PaidChatSlaViolation
from ..auth import get_current_user

router = APIRouter(prefix="/api/therapists", tags=["therapists"])

@router.get("")
async def get_therapists(db: Session = Depends(get_db)):
    # Fix N+1 query issue by using a join instead of looping queries
    results = db.query(User, TherapistProfile).outerjoin(
        TherapistProfile, User.id == TherapistProfile.user_id
    ).filter(
        User.role == "therapist", 
        User.account_status == "active"
    ).all()
    
    res = []
    for t, profile in results:
        # Reviews still need separate query, optimization for that would be another step.
        # But this removes the TherapistProfile N+1
        reviews = db.query(Review).filter(Review.therapist_id == t.id).all()
        rating = 5.0
        review_count = 0
        if reviews:
            rating = round(sum([r.rating for r in reviews]) / len(reviews), 1)
            review_count = len(reviews)
        elif profile:
            rating = profile.rating
            review_count = profile.review_count

        res.append({
            "id": t.id,
            "display_name": t.display_name,
            "email": t.email,
            "age": t.age,
            "gender": t.gender,
            "region": t.region,
            "profession": t.profession,
            "specialty": profile.specialty if profile else "General Therapy",
            "bio": profile.bio if profile else "No bio provided yet.",
            "languages": json.loads(profile.languages) if (profile and profile.languages) else ["English"],
            "experience": profile.experience if profile else 0,
            "rating": rating,
            "review_count": review_count,
            "booking_url": profile.booking_url if profile else "",
            "is_crisis_certified": bool(profile.is_crisis_certified) if profile else False,
            "license_number": profile.license_number if profile else "",
            "clinical_specializations": json.loads(profile.clinical_specializations) if (profile and profile.clinical_specializations) else [],
            "loyalty_points": profile.loyalty_points if profile else 0
        })
    return {"data": res, "error": None}

@router.get("/profile")
async def get_therapist_profile(therapist_id: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tid = therapist_id or current_user.id
    therapist = db.query(User).filter(User.id == tid).first()
    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")

    profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == tid).first()
    if not profile:
        profile = TherapistProfile(
            user_id=tid,
            specialty="Counselor",
            bio="Safe space practitioner.",
            experience=2,
            languages='["English"]',
            clinical_specializations='[]',
            bank_details='{}',
            notification_prefs='{"email": true, "sms": false}'
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return {
        "data": {
            "id": therapist.id,
            "display_name": therapist.display_name,
            "email": therapist.email,
            "experience": profile.experience,
            "specialty": profile.specialty,
            "bio": profile.bio,
            "languages": json.loads(profile.languages) if profile.languages else ["English"],
            "rating": profile.rating,
            "review_count": profile.review_count,
            "booking_url": profile.booking_url,
            "is_crisis_certified": bool(profile.is_crisis_certified),
            "license_number": profile.license_number,
            "bank_details": json.loads(profile.bank_details) if profile.bank_details else {},
            "notification_prefs": json.loads(profile.notification_prefs) if profile.notification_prefs else {},
            "clinical_specializations": json.loads(profile.clinical_specializations) if profile.clinical_specializations else [],
            "loyalty_points": profile.loyalty_points
        },
        "error": None
    }

@router.post("/profile/update")
async def update_profile(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tid = current_user.id
    profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == tid).first()
    if not profile:
        profile = TherapistProfile(user_id=tid)
        db.add(profile)

    if "specialty" in data:
        profile.specialty = data["specialty"]
    if "bio" in data:
        profile.bio = data["bio"]
    if "experience" in data:
        profile.experience = int(data["experience"])
    if "booking_url" in data:
        profile.booking_url = data["booking_url"]
    if "is_crisis_certified" in data:
        profile.is_crisis_certified = 1 if data["is_crisis_certified"] else 0
    if "license_number" in data:
        profile.license_number = data["license_number"]
    if "languages" in data:
        profile.languages = json.dumps(data["languages"])
    if "clinical_specializations" in data:
        profile.clinical_specializations = json.dumps(data["clinical_specializations"])
    if "bank_details" in data:
        profile.bank_details = json.dumps(data["bank_details"])
    if "notification_prefs" in data:
        profile.notification_prefs = json.dumps(data["notification_prefs"])
        
    profile.updated_at = time.strftime('%Y-%m-%dT%H:%M:%SZ')
    db.commit()
    db.refresh(profile)
    return {"data": {"status": "success"}, "error": None}

@router.get("/applications")
async def get_applications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    apps = db.query(TherapistApplication).order_by(TherapistApplication.submitted_at.desc()).all()
    res = []
    for a in apps:
        res.append({
            "id": a.id,
            "userId": a.user_id,
            "fullName": a.full_name,
            "email": a.email,
            "phone": a.phone,
            "yearsExperience": a.years_experience,
            "specialization": a.specialization,
            "licenseNumber": a.license_number,
            "cvFileName": a.cv_file,
            "degreeFileName": a.degree_file,
            "status": a.status,
            "submittedAt": int(float(a.submitted_at)) if a.submitted_at.replace('.', '', 1).isdigit() else int(time.time() * 1000)
        })
    return {"data": res, "error": None}

@router.post("/applications/submit")
async def submit_application(app_data: dict, db: Session = Depends(get_db)):
    # Standard handler for new therapist applications
    app_id = app_data.get("id") or str(uuid.uuid4())
    user_id = app_data.get("userId") or app_data.get("user_id") or str(uuid.uuid4())
    
    new_app = TherapistApplication(
        id=app_id,
        user_id=user_id,
        full_name=app_data.get("fullName", ""),
        email=app_data.get("email", ""),
        phone=app_data.get("phone", ""),
        years_experience=int(app_data.get("yearsExperience", 0)),
        specialization=app_data.get("specialization", ""),
        license_number=app_data.get("licenseNumber", ""),
        cv_file=app_data.get("cvFileName", ""),
        degree_file=app_data.get("degreeFileName", ""),
        status="pending",
        submitted_at=str(time.time() * 1000)
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)
    return {"data": {"id": new_app.id, "status": "pending"}, "error": None}

@router.post("/applications/status")
async def change_application_status(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    id = req.get("id")
    status_val = req.get("status")
    
    app_choice = db.query(TherapistApplication).filter(TherapistApplication.id == id).first()
    if not app_choice:
        raise HTTPException(status_code=404, detail="Application not found")
        
    app_choice.status = status_val
    if status_val == "approved":
        # Promote user to role 'therapist'
        tgt_user = db.query(User).filter(User.id == app_choice.user_id).first()
        if tgt_user:
            tgt_user.role = "therapist"
            # Seed profile automatically
            prof = db.query(TherapistProfile).filter(TherapistProfile.user_id == tgt_user.id).first()
            if not prof:
                prof = TherapistProfile(
                    user_id=tgt_user.id,
                    specialty=app_choice.specialization,
                    bio="Newly approved, licensed clinician.",
                    experience=app_choice.years_experience,
                    languages='["English"]',
                    license_number=app_choice.license_number
                )
                db.add(prof)

    db.commit()
    return {"data": {"id": id, "status": status_val}, "error": None}

@router.get("/connections")
async def get_connections(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(TherapistConnection)
    if not current_user.is_admin:
        if current_user.role == "therapist":
            query = query.filter(TherapistConnection.therapist_id == current_user.id)
        else:
            query = query.filter(TherapistConnection.client_id == current_user.id)
            
    connections = query.all()
    
    # Pre-fetch all users to avoid N+1 queries
    user_ids = set()
    for c in connections:
        if c.client_id:
            user_ids.add(c.client_id)
        if c.therapist_id:
            user_ids.add(c.therapist_id)
            
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(list(user_ids))).all()
        users_map = {u.id: u for u in users}

    res = []
    for c in connections:
        client = users_map.get(c.client_id)
        therapist = users_map.get(c.therapist_id)
        res.append({
            "id": c.id,
            "clientId": c.client_id,
            "clientName": client.display_name if client else "Anonymous Patient",
            "clientEmail": client.email if client else "anonymous@sukoon.ai",
            "therapistId": c.therapist_id,
            "therapistName": therapist.display_name if therapist else "Anonymous Therapist",
            "status": c.status,
            "notes": c.notes,
            "meetingLink": c.meeting_link,
            "createdAt": c.created_at
        })
    return {"data": res, "error": None}

@router.get("/patients")
async def get_patients(therapistId: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tid = therapistId or current_user.id
    connections = db.query(TherapistConnection).filter(TherapistConnection.therapist_id == tid, TherapistConnection.status == "active").all()
    
    # Pre-fetch all users to avoid N+1 queries
    user_ids = set()
    for c in connections:
        if c.client_id:
            user_ids.add(c.client_id)
            
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(list(user_ids))).all()
        users_map = {u.id: u for u in users}

    res = []
    for c in connections:
        client = users_map.get(c.client_id)
        res.append({
            "id": c.id,
            "clientId": c.client_id,
            "clientName": client.display_name if client else "Patient",
            "clientEmail": client.email if client else "patient@sukoon.ai",
            "status": c.status,
            "notes": c.notes,
            "meetingLink": c.meeting_link,
            "createdAt": c.created_at
        })
    return {"data": res, "error": None}

@router.post("/connections/assign")
async def assign_therapist(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can manually register assignments")
        
    client_id = data.get("clientId")
    therapist_id = data.get("therapistId")
    frequency = data.get("frequency", "Weekly")
    reason = data.get("reason", "")
    
    # End existing connections for this client
    db.query(TherapistConnection).filter(TherapistConnection.client_id == client_id).update({
        "status": "completed"
    })
    
    conn_id = f"conn-{uuid.uuid4().hex[:12]}"
    conn = TherapistConnection(
        id=conn_id,
        client_id=client_id,
        therapist_id=therapist_id,
        status="active",
        notes=f"Frequency: {frequency}. Reason: {reason}",
        meeting_link="https://meet.google.com/sukoon-private-session",
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(conn)
    db.commit()
    return {"data": {"id": conn_id, "status": "active"}, "error": None}

@router.post("/connections/break")
async def break_connection(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = req.get("id")
    connection = db.query(TherapistConnection).filter(TherapistConnection.id == cid).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection registration details not found")
        
    connection.status = "completed"
    db.commit()
    return {"data": {"id": cid, "status": "completed"}, "error": None}

@router.post("/connections/meeting")
async def update_meeting_link(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = req.get("connectionId") or req.get("id")
    link = req.get("link")
    
    conn = db.query(TherapistConnection).filter(TherapistConnection.id == cid).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection details not found")
        
    conn.meeting_link = link
    db.commit()
    return {"data": {"id": cid, "meetingLink": link}, "error": None}

@router.get("/schedule")
async def get_schedule(therapistId: str, db: Session = Depends(get_db)):
    slots = db.query(CalendarSlot).filter(CalendarSlot.therapist_id == therapistId).all()
    res = []
    for s in slots:
        res.append({
            "id": s.id,
            "therapist_id": s.therapist_id,
            "date": s.date,
            "time": s.time,
            "duration": s.duration,
            "status": s.status,
            "client_name": s.client_name,
            "session_type": s.session_type
        })
    return {"data": res, "error": None}

@router.post("/schedule/add")
async def add_slot(slot_data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    slot_id = f"slot-{uuid.uuid4().hex[:12]}"
    new_slot = CalendarSlot(
        id=slot_id,
        therapist_id=current_user.id,
        date=slot_data.get("date"),
        time=slot_data.get("time"),
        duration=int(slot_data.get("duration", 60)),
        status="available"
    )
    db.add(new_slot)
    db.commit()
    return {"data": {"id": slot_id}, "error": None}

@router.post("/schedule/delete")
async def delete_slot(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sid = req.get("id")
    db.query(CalendarSlot).filter(CalendarSlot.id == sid, CalendarSlot.therapist_id == current_user.id).delete()
    db.commit()
    return {"data": {"id": sid}, "error": None}

# Boost and subscription endpoint stubs matching features
@router.post("/boosts/create")
async def create_boost(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bid = f"boost-{uuid.uuid4().hex[:12]}"
    new_boost = TherapistBoost(
        id=bid,
        therapist_id=current_user.id,
        tier=req.get("tier", "Featured"),
        cost=float(req.get("cost", 50.0)),
        clicks=0,
        status="Active",
        expiry=time.strftime('%Y-%m-%d', time.localtime(time.time() + 7 * 86400))
    )
    db.add(new_boost)
    db.commit()
    return {"data": {"id": bid, "status": "Active"}, "error": None}

@router.post("/followup/send")
async def send_followup(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    therapist_id = current_user.id
    patient_id = req.get("patient_id")
    booking_id = req.get("booking_id")
    content = req.get("content")

    # 1. Verify Assignment
    connection = db.query(TherapistConnection).filter(
        TherapistConnection.therapist_id == therapist_id,
        TherapistConnection.client_id == patient_id,
        TherapistConnection.status == "active"
    ).first()
    if not connection:
        raise HTTPException(status_code=403, detail="Patient not assigned or connection inactive.")

    # 2. Check existance of followup
    followup = db.query(FollowupConversation).filter(
        FollowupConversation.booking_id == booking_id
    ).first()
    
    if not followup:
        # Create new if doesn't exist
        followup = FollowupConversation(
            id=str(uuid.uuid4()),
            therapist_id=therapist_id,
            patient_id=patient_id,
            booking_id=booking_id,
            message_count=0,
            followup_expiry_date=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.localtime(time.time() + 30 * 86400)),
            last_message_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
        )
        db.add(followup)
        db.commit()

    # 3. Limit Check
    if followup.message_count >= 10:
        raise HTTPException(status_code=400, detail="Follow-up limit reached.")

    # 4. Save message (using chat router's logic, but here for now)
    # Actually, the requirement says "Patient receives Notification"
    # I should add a notification entry.
    
    from ..models import Notification
    notification = Notification(
        id=str(uuid.uuid4()),
        user_id=patient_id,
        title="New Follow-up Message",
        message=f"Therapist sent you a follow-up: {content[:20]}...",
        type="message",
        is_read=0
    )
    db.add(notification)
    
    followup.message_count += 1
    followup.last_message_at = time.strftime('%Y-%m-%dT%H:%M:%SZ')
    db.commit()

    return {"data": {"message_count": followup.message_count}, "error": None}

@router.post("/followup/request/send")
async def send_followup_request(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Only therapists can send follow-up requests.")
        
    therapist_id = current_user.id
    client_id = req.get("client_id")
    
    if not client_id:
        raise HTTPException(status_code=400, detail="client_id is required.")
        
    # Check if patient has any other active therapist connection
    active_conn = db.query(TherapistConnection).filter(
        TherapistConnection.client_id == client_id,
        TherapistConnection.status == "active"
    ).first()
    
    if active_conn:
        raise HTTPException(
            status_code=400, 
            detail="Patient currently has an active therapist. Follow-up is blocked."
        )
        
    # Limit: Max 1 follow-up request per patient every 7 days.
    seven_days_ago = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.localtime(time.time() - 7 * 86400))
    recent_req = db.query(FollowupRequest).filter(
        FollowupRequest.therapist_id == therapist_id,
        FollowupRequest.patient_id == client_id,
        FollowupRequest.created_at >= seven_days_ago
    ).first()
    
    if recent_req:
        raise HTTPException(
            status_code=400, 
            detail="Maximum 1 follow-up request per patient every 7 days allowed."
        )
        
    # Create request
    req_id = f"freq-{uuid.uuid4().hex[:12]}"
    new_request = FollowupRequest(
        id=req_id,
        therapist_id=therapist_id,
        patient_id=client_id,
        status="pending",
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_request)
    
    therapist_name = current_user.display_name or "Therapist"
    from ..models import Notification
    notification = Notification(
        id=str(uuid.uuid4()),
        user_id=client_id,
        title="Reconnect Request",
        message=f"{therapist_name} would like to reconnect with you.",
        type="reconnect",
        is_read=0
    )
    db.add(notification)
    db.commit()
    
    return {"data": {"id": req_id, "status": "pending"}, "error": None}

@router.post("/followup/request/decide")
async def decide_followup_request(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    request_id = req.get("request_id")
    action = req.get("action") # "accept" or "decline"
    
    follow_req = db.query(FollowupRequest).filter(FollowupRequest.id == request_id).first()
    if not follow_req:
        raise HTTPException(status_code=404, detail="Follow-up request not found.")
        
    if follow_req.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized.")
        
    if action == "accept":
        follow_req.status = "accepted"
        
        # Open up a temporary follow-up conversation limits
        conv = db.query(FollowupConversation).filter(
            FollowupConversation.patient_id == follow_req.patient_id,
            FollowupConversation.therapist_id == follow_req.therapist_id
        ).first()
        
        thirty_days_later = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.localtime(time.time() + 30 * 86400))
        if conv:
            conv.message_count = 0
            conv.followup_expiry_date = thirty_days_later
            conv.last_message_at = time.strftime('%Y-%m-%dT%H:%M:%SZ')
        else:
            conv = FollowupConversation(
                id=f"fcv-{uuid.uuid4().hex[:12]}",
                therapist_id=follow_req.therapist_id,
                patient_id=follow_req.patient_id,
                message_count=0,
                followup_expiry_date=thirty_days_later,
                last_message_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
            )
            db.add(conv)
            
        # Create user notification for counselor
        client_name = current_user.display_name or "Client"
        from ..models import Notification
        notification = Notification(
            id=str(uuid.uuid4()),
            user_id=follow_req.therapist_id,
            title="Follow-up Request Accepted",
            message=f"{client_name} accepted your reconnect request. 10 messages chat opened.",
            type="message",
            is_read=0
        )
        db.add(notification)
        
    elif action == "decline":
        follow_req.status = "declined"
        client_name = current_user.display_name or "Client"
        from ..models import Notification
        notification = Notification(
            id=str(uuid.uuid4()),
            user_id=follow_req.therapist_id,
            title="Follow-up Request Declined",
            message=f"{client_name} declined your reconnect request.",
            type="message",
            is_read=0
        )
        db.add(notification)
        
    else:
        raise HTTPException(status_code=400, detail="Invalid action.")
        
    db.commit()
    return {"data": {"status": follow_req.status}, "error": None}

@router.post("/paid-chat/configure")
async def configure_paid_chat(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Only therapists can configure paid chat support.")
        
    price_1d = req.get("price_1d")
    price_7d = req.get("price_7d")
    price_1m = req.get("price_1m")
    
    profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Therapist profile not found.")
        
    # Check if price changes are allowed (maximum once every 30 days)
    now = time.time()
    if profile.paid_chat_price_updated_at:
        try:
            last_epoch = float(profile.paid_chat_price_updated_at)
            days_passed = (now - last_epoch) / 86400.0
            if days_passed < 30.0:
                import math
                raise HTTPException(
                    status_code=400,
                    detail=f"Price changes allowed only once every 30 days. Please wait {math.ceil(30.0 - days_passed)} more days."
                )
        except ValueError:
            pass
            
    if price_1d is not None:
        profile.pricing_45 = float(price_1d)
    if price_7d is not None:
        profile.pricing_60 = float(price_7d)
    if price_1m is not None:
        profile.pricing_90 = float(price_1m)
        
    profile.updated_at = str(now)
    db.commit()
    
    return {
        "data": {
            "price_1d": profile.pricing_45,
            "price_7d": profile.pricing_60,
            "price_1m": profile.pricing_90,
            "updated_at": profile.updated_at
        },
        "error": None
    }

@router.post("/paid-chat/purchase")
async def purchase_paid_chat(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    therapist_id = req.get("therapist_id")
    duration_type = req.get("duration_type") # "1d", "7d", "1m"
    
    if duration_type not in ["1d", "7d", "1m"]:
        raise HTTPException(status_code=400, detail="Invalid duration type.")
        
    profile = db.query(TherapistProfile).filter(TherapistProfile.user_id == therapist_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Therapist profile not found.")
        
    # Get price
    price = 0.0
    days = 1
    if duration_type == "1d":
        price = profile.pricing_45 or 5.0
        days = 1
    elif duration_type == "7d":
        price = profile.pricing_60 or 25.0
        days = 7
    elif duration_type == "1m":
        price = profile.pricing_90 or 80.0
        days = 30
        
    expires_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.localtime(time.time() + days * 86400))
    
    # Store purchase
    purchase_id = f"pcp-{uuid.uuid4().hex[:12]}"
    new_purchase = PaidChatSupport(
        id=purchase_id,
        patient_id=current_user.id,
        therapist_id=therapist_id,
        duration_type=duration_type,
        expires_at=expires_at,
        price=price,
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_purchase)
    
    # Create notification for client and therapist
    from ..models import Notification
    db.add(Notification(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        title="Chat Support Purchased",
        message=f"You purchased {duration_type} chat support. Limits are removed until {expires_at}.",
        type="message",
        is_read=0
    ))
    db.add(Notification(
        id=str(uuid.uuid4()),
        user_id=therapist_id,
        title="Chat Support Purchased",
        message=f"Client purchased {duration_type} chat support. Response SLA (24h) is active.",
        type="message",
        is_read=0
    ))
    
    # Also activate therapist connection if not active
    conn = db.query(TherapistConnection).filter(
        TherapistConnection.client_id == current_user.id,
        TherapistConnection.therapist_id == therapist_id
    ).first()
    if conn:
        conn.status = "active"
        conn.chat_expires_at = expires_at
    else:
        conn = TherapistConnection(
            id=f"conn-{uuid.uuid4().hex[:12]}",
            client_id=current_user.id,
            therapist_id=therapist_id,
            status="active",
            chat_expires_at=expires_at,
            created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
        )
        db.add(conn)
        
    db.commit()
    return {"data": {"id": purchase_id, "expires_at": expires_at}, "error": None}

def check_and_create_sla_violations(db: Session):
    # Query all active PaidChatSupport subscriptions
    current_time_str = time.strftime('%Y-%m-%dT%H:%M:%SZ')
    active_supports = db.query(PaidChatSupport).all()
    
    for support in active_supports:
        # Find the latest message in direct_messages between this patient and therapist
        from ..models import DirectMessage
        latest_msg = db.query(DirectMessage).filter(
            ((DirectMessage.sender_id == support.patient_id) & (DirectMessage.receiver_id == support.therapist_id)) |
            ((DirectMessage.sender_id == support.therapist_id) & (DirectMessage.receiver_id == support.patient_id))
        ).order_by(DirectMessage.created_at.desc()).first()
        
        if latest_msg and latest_msg.sender_id == support.patient_id:
            # Let's see if 24 hours (86400 seconds) have passed
            try:
                msg_time = time.strptime(latest_msg.created_at, '%Y-%m-%dT%H:%M:%SZ')
                msg_epoch = time.mktime(msg_time)
                now_epoch = time.time()
                diff_hours = (now_epoch - msg_epoch) / 3600.0
                if diff_hours > 24.0:
                    # Check if a violation for this message already exists
                    violation = db.query(PaidChatSlaViolation).filter(
                        PaidChatSlaViolation.last_message_id == latest_msg.id
                    ).first()
                    if not violation:
                        # Create violation
                        violation_id = f"viol-{uuid.uuid4().hex[:12]}"
                        new_violation = PaidChatSlaViolation(
                            id=violation_id,
                            patient_id=support.patient_id,
                            therapist_id=support.therapist_id,
                            support_id=support.id,
                            last_message_id=latest_msg.id,
                            last_message_at=latest_msg.created_at,
                            status="pending_refund",
                            created_at=current_time_str
                        )
                        db.add(new_violation)
                        # Create notification for admin
                        from ..models import Notification
                        admin_notif = Notification(
                            id=str(uuid.uuid4()),
                            user_id="admin-sys-001",  # Admin user ID from main.py seed
                            title="SLA Team Alert",
                            message=f"Therapist missed 24hr reply SLA for paid chat.",
                            type="sla_alert",
                            is_read=0
                        )
                        db.add(admin_notif)
                        db.commit()
            except Exception as e:
                print(f"Error checking SLA: {e}", flush=True)

@router.get("/admin/sla-reports")
async def get_sla_reports(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access SLA reports.")
        
    # Run SLA auto-detection scans dynamically to make sure reports are 100% up-to-date and automatic
    check_and_create_sla_violations(db)
    
    # Pre-fetch all needed lists to optimize user prefetching in one step
    requests = db.query(FollowupRequest).all()
    conversations = db.query(FollowupConversation).all()
    purchases = db.query(PaidChatSupport).all()
    violations = db.query(PaidChatSlaViolation).all()
    
    # Pre-fetch all unique user IDs to avoid dozens of N+1 database queries
    user_ids = set()
    for r in requests:
        if r.therapist_id: user_ids.add(r.therapist_id)
        if r.patient_id: user_ids.add(r.patient_id)
    for c in conversations:
        if c.therapist_id: user_ids.add(c.therapist_id)
        if c.patient_id: user_ids.add(c.patient_id)
    for p in purchases:
        if p.therapist_id: user_ids.add(p.therapist_id)
        if p.patient_id: user_ids.add(p.patient_id)
    for v in violations:
        if v.therapist_id: user_ids.add(v.therapist_id)
        if v.patient_id: user_ids.add(v.patient_id)
        
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(list(user_ids))).all()
        users_map = {u.id: u for u in users}
        
    requests_details = []
    for r in requests:
        therapist = users_map.get(r.therapist_id)
        patient = users_map.get(r.patient_id)
        requests_details.append({
            "id": r.id,
            "therapist_id": r.therapist_id,
            "therapist_name": therapist.display_name if therapist else "Unknown",
            "patient_id": r.patient_id,
            "patient_name": patient.display_name if patient else "Unknown",
            "status": r.status,
            "created_at": r.created_at
        })
        
    conversations_details = []
    for c in conversations:
        therapist = users_map.get(c.therapist_id)
        patient = users_map.get(c.patient_id)
        conversations_details.append({
            "id": c.id,
            "therapist_name": therapist.display_name if therapist else "Unknown",
            "patient_name": patient.display_name if patient else "Unknown",
            "message_count": c.message_count,
            "expiry": c.followup_expiry_date,
            "last_message_at": c.last_message_at
        })
        
    purchases_details = []
    for p in purchases:
        therapist = users_map.get(p.therapist_id)
        patient = users_map.get(p.patient_id)
        purchases_details.append({
            "id": p.id,
            "therapist_name": therapist.display_name if therapist else "Unknown",
            "patient_name": patient.display_name if patient else "Unknown",
            "duration": p.duration_type,
            "expires_at": p.expires_at,
            "price": p.price,
            "created_at": p.created_at
        })
        
    violations_details = []
    for v in violations:
        therapist = users_map.get(v.therapist_id)
        patient = users_map.get(v.patient_id)
        violations_details.append({
            "id": v.id,
            "therapist_name": therapist.display_name if therapist else "Unknown",
            "patient_name": patient.display_name if patient else "Unknown",
            "last_message_at": v.last_message_at,
            "status": v.status,
            "created_at": v.created_at
        })
        
    return {
        "data": {
            "followup_requests": requests_details,
            "followup_conversations": conversations_details,
            "paid_chat_purchases": purchases_details,
            "sla_violations": violations_details
        },
        "error": None
    }

@router.post("/admin/sla-viol/resolve")
async def resolve_sla_violation(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can resolve SLA violations.")
        
    violation_id = req.get("violation_id")
    action = req.get("action") # "refunded" or "dismissed"
    
    violation = db.query(PaidChatSlaViolation).filter(PaidChatSlaViolation.id == violation_id).first()
    if not violation:
        raise HTTPException(status_code=404, detail="SLA Violation not found.")
        
    violation.status = action
    db.commit()
    return {"data": {"id": violation_id, "status": action}, "error": None}

@router.get("/boosts")
async def get_boosts(therapistId: str = None, db: Session = Depends(get_db)):
    query = db.query(TherapistBoost)
    if therapistId:
        query = query.filter(TherapistBoost.therapist_id == therapistId)
    boosts = query.all()
    res = []
    for b in boosts:
        res.append({
            "id": b.id,
            "therapistId": b.therapist_id,
            "tier": b.tier,
            "cost": b.cost,
            "clicks": b.clicks,
            "status": b.status,
            "expiry": b.expiry
        })
    return {"data": res, "error": None}

@router.post("/subscriptions/create")
async def create_subscription(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sid = f"sub-{uuid.uuid4().hex[:12]}"
    new_sub = TherapistSubscription(
        id=sid,
        therapist_id=current_user.id,
        plan=req.get("plan", "Standard"),
        payout_share=float(req.get("payout_share", 0.8)),
        status="Active",
        renews_at=time.strftime('%Y-%m-%d', time.localtime(time.time() + 30 * 86400))
    )
    db.add(new_sub)
    db.commit()
    return {"data": {"id": sid, "status": "Active"}, "error": None}

@router.get("/subscriptions")
async def get_subscriptions(therapistId: str = None, db: Session = Depends(get_db)):
    query = db.query(TherapistSubscription)
    if therapistId:
        query = query.filter(TherapistSubscription.therapist_id == therapistId)
    subs = query.all()
    res = []
    for s in subs:
        res.append({
            "id": s.id,
            "therapistId": s.therapist_id,
            "plan": s.plan,
            "payout_share": s.payout_share,
            "status": s.status,
            "renewsAt": s.renews_at
        })
    return {"data": res, "error": None}
