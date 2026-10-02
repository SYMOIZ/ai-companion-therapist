import time
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import MarketingExpense, PayoutRequest, WalletTransaction, User, AdminAction
from ..auth import get_current_user

router = APIRouter(prefix="/api/finance", tags=["finance"])

@router.get("/stats")
async def get_finance_stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
         raise HTTPException(status_code=403, detail="Forbidden")

    # Aggregate expenses, payouts and revenues
    expenses = db.query(MarketingExpense).all()
    payouts = db.query(PayoutRequest).all()
    credits = db.query(WalletTransaction).filter(WalletTransaction.type == "Credit", WalletTransaction.status == "Verified").all()
    txs = db.query(WalletTransaction).filter(WalletTransaction.type == "Credit").all()

    total_expenses = sum([e.amount for e in expenses])
    pending_payouts = sum([p.amount for p in payouts if p.status == "Pending"])
    cleared_payouts = sum([p.amount for p in payouts if p.status == "Processed"])

    total_revenue = sum([c.amount for c in credits])
    total_therapist_share = sum([c.therapist_payout for c in credits])
    gross_profit = total_revenue - total_therapist_share
    net_income = gross_profit - total_expenses

    therapist_map = {}
    for t in txs:
         if t.therapist_id:
             therapist_map[t.therapist_id] = therapist_map.get(t.therapist_id, 0) + t.amount
    
    top_t_id = max(therapist_map, key=therapist_map.get) if therapist_map else ""
    top_therapist_name = "Unknown"
    if top_t_id:
         t_user = db.query(User).filter(User.id == top_t_id).first()
         if t_user:
             top_therapist_name = t_user.display_name

    client_map = {}
    for t in txs:
         if t.client_id:
             client_map[t.client_id] = client_map.get(t.client_id, 0) + t.amount
             
    top_c_id = max(client_map, key=client_map.get) if client_map else ""
    top_client_name = "Unknown"
    if top_c_id:
         c_user = db.query(User).filter(User.id == top_c_id).first()
         if c_user:
             top_client_name = c_user.display_name

    return {
        "revenue": total_revenue,
        "profit": gross_profit,
        "marketing": total_expenses,
        "net_income": net_income,
        "pending_payouts": pending_payouts,
        "cleared_payouts": cleared_payouts,
        "top_therapist": {"name": top_therapist_name, "total": therapist_map.get(top_t_id, 0)},
        "top_client": {"name": top_client_name, "total": client_map.get(top_c_id, 0)},
        "most_active": {"name": "None", "sessions": 0}
    }

@router.get("/expenses")
async def get_expenses(db: Session = Depends(get_db)):
    expenses = db.query(MarketingExpense).all()
    res = []
    for e in expenses:
        res.append({
            "id": e.id,
            "platform": e.platform,
            "amount": e.amount,
            "description": e.description,
            "date": int(time.mktime(time.strptime(e.date, '%Y-%m-%dT%H:%M:%SZ')) * 1000) if getattr(e, 'date', None) else int(time.time() * 1000)
        })
    return {"data": res, "error": None}

@router.post("/expenses/add")
async def add_expense(expense_data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    eid = f"exp-{uuid.uuid4().hex[:12]}"
    new_exp = MarketingExpense(
        id=eid,
        platform=expense_data.get("platform"),
        amount=float(expense_data.get("amount", 0.0)),
        description=expense_data.get("description", ""),
        date=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_exp)
    db.commit()
    return {"data": {"id": eid}, "error": None}

@router.get("/payouts")
async def get_payouts(db: Session = Depends(get_db)):
    payouts = db.query(PayoutRequest).all()
    res = []
    for p in payouts:
        res.append({
            "id": p.id,
            "therapistId": p.therapist_id,
            "therapistName": p.therapist_name,
            "amount": p.amount,
            "status": p.status,
            "requestDate": int(time.time() * 1000), # placeholder matching epoch
            "method": p.method,
            "processedAt": int(time.time() * 1000) if p.processed_at else None
        })
    return {"data": res, "error": None}

@router.post("/payouts/process")
async def process_payout(data: dict, db: Session = Depends(get_db)):
    pid = data.get("id")
    status = data.get("status")
    
    payout = db.query(PayoutRequest).filter(PayoutRequest.id == pid).first()
    if payout:
        payout.status = status
        payout.processed_at = time.strftime('%Y-%m-%dT%H:%M:%SZ')
        db.commit()
    return {"data": True, "error": None}

@router.post("/payouts/request")
async def request_payout(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pid = f"pay-{uuid.uuid4().hex[:12]}"
    new_req = PayoutRequest(
        id=pid,
        therapist_id=current_user.id,
        therapist_name=current_user.display_name,
        amount=float(data.get("amount", 0.0)),
        status="Pending",
        request_date=time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        method=f"{data.get('bankName')} - {data.get('iban')}"
    )
    db.add(new_req)
    db.commit()
    return {"data": {"id": pid, "status": "Pending"}, "error": None}

@router.get("/transactions")
@router.get("/api/transactions")
@router.get("/api/wallet-transactions")
async def get_transactions(db: Session = Depends(get_db)):
    txs = db.query(WalletTransaction).all()
    res = []
    for t in txs:
        res.append({
            "id": t.id,
            "userId": t.user_id,
            "therapistId": t.therapist_id,
            "clientId": t.client_id,
            "amount": t.amount,
            "type": t.type,
            "status": t.status,
            "description": t.description,
            "therapistPayout": t.therapist_payout,
            "date": t.date
        })
    return {"data": res, "error": None}
