import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import SessionBooking, User
from ..auth import get_current_user

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

@router.post("/create")
async def create_booking(booking_data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking_id = f"booking-{uuid.uuid4().hex[:12]}"
    
    # Read payloads either wrapped or unwrapped
    client_id = booking_data.get("client_id") or booking_data.get("clientId") or current_user.id
    therapist_id = booking_data.get("therapist_id") or booking_data.get("therapistId")
    session_type = booking_data.get("session_type") or booking_data.get("sessionType")
    date = booking_data.get("date")
    time_slot = booking_data.get("time_slot") or booking_data.get("timeSlot") or booking_data.get("time")
    duration = booking_data.get("duration", 60)
    fee = booking_data.get("fee", 0.0)
    payment_screenshot = booking_data.get("payment_screenshot") or booking_data.get("paymentScreenshot") or ""
    transaction_id = booking_data.get("transaction_id") or booking_data.get("transactionId") or ""
    notes = booking_data.get("notes") or ""

    if not therapist_id or not date or not time_slot:
        raise HTTPException(status_code=400, detail="Missing booking inputs (therapist_id, date, time_slot are required)")

    booking = SessionBooking(
        id=booking_id,
        client_id=client_id,
        therapist_id=therapist_id,
        session_type=session_type,
        date=date,
        time_slot=time_slot,
        duration=int(duration),
        fee=float(fee),
        status="Pending",
        payment_screenshot=payment_screenshot,
        transaction_id=transaction_id,
        notes=notes
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    return {"data": {
        "id": booking.id,
        "client_id": booking.client_id,
        "therapist_id": booking.therapist_id,
        "session_type": booking.session_type,
        "date": booking.date,
        "time_slot": booking.time_slot,
        "duration": booking.duration,
        "fee": booking.fee,
        "status": booking.status,
        "payment_screenshot": booking.payment_screenshot,
        "transaction_id": booking.transaction_id,
        "notes": booking.notes
    }, "error": None}

@router.post("/update")
async def update_booking(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    id = req.get("id")
    updates = req.get("updates") or {}
    status = req.get("status") or updates.get("status")

    if not id:
        raise HTTPException(status_code=400, detail="Missing booking id")

    booking = db.query(SessionBooking).filter(SessionBooking.id == id).first()
    if not booking:
         raise HTTPException(status_code=404, detail="Booking not found")

    if status:
        booking.status = status
    if "notes" in req:
        booking.notes = req.get("notes")
    elif "notes" in updates:
        booking.notes = updates.get("notes")

    db.commit()
    db.refresh(booking)
    return {"data": {
        "id": booking.id,
        "status": booking.status,
        "notes": booking.notes
    }, "error": None}

@router.get("")
async def get_bookings(clientId: str = None, therapistId: str = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(SessionBooking)
    
    # If not admin, check roles or apply filters
    if not current_user.is_admin:
        if current_user.role == "therapist":
            query = query.filter(SessionBooking.therapist_id == current_user.id)
        else:
            query = query.filter(SessionBooking.client_id == current_user.id)
    else:
        if clientId:
            query = query.filter(SessionBooking.client_id == clientId)
        if therapistId:
            query = query.filter(SessionBooking.therapist_id == therapistId)

    bookings = query.all()
    
    # Pre-fetch all users to avoid N+1 queries
    user_ids = set()
    for b in bookings:
        if b.client_id:
            user_ids.add(b.client_id)
        if b.therapist_id:
            user_ids.add(b.therapist_id)
            
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(list(user_ids))).all()
        users_map = {u.id: u for u in users}

    res = []
    for b in bookings:
        client = users_map.get(b.client_id)
        therapist = users_map.get(b.therapist_id)
        res.append({
            "id": b.id,
            "clientId": b.client_id,
            "clientName": client.display_name if client else "Anonymous Client",
            "therapistId": b.therapist_id,
            "therapistName": therapist.display_name if therapist else "Anonymous Therapist",
            "sessionType": b.session_type,
            "date": b.date,
            "timeSlot": b.time_slot,
            "duration": b.duration,
            "fee": b.fee,
            "status": b.status,
            "paymentScreenshot": b.payment_screenshot,
            "transactionId": b.transaction_id,
            "notes": b.notes
        })
    return {"data": res, "error": None}

@router.get("/admin")
async def get_all_bookings_admin(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    bookings = db.query(SessionBooking).all()
    
    # Pre-fetch all users to avoid N+1 queries
    user_ids = set()
    for b in bookings:
        if b.client_id:
            user_ids.add(b.client_id)
        if b.therapist_id:
            user_ids.add(b.therapist_id)
            
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(list(user_ids))).all()
        users_map = {u.id: u for u in users}

    res = []
    for b in bookings:
        client = users_map.get(b.client_id)
        therapist = users_map.get(b.therapist_id)
        res.append({
            "id": b.id,
            "clientId": b.client_id,
            "clientName": client.display_name if client else "Anonymous",
            "therapistId": b.therapist_id,
            "therapistName": therapist.display_name if therapist else "Anonymous",
            "sessionType": b.session_type,
            "date": b.date,
            "timeSlot": b.time_slot,
            "duration": b.duration,
            "fee": b.fee,
            "status": b.status,
            "paymentScreenshot": b.payment_screenshot,
            "transactionId": b.transaction_id,
            "notes": b.notes
        })
    return {"data": res, "error": None}
