import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, UserBadge, RewardTransaction, JournalEntry, ChatSession
from ..auth import verify_token

router = APIRouter(prefix="/api/gamification", tags=["gamification"])

BADGES = [
    {"id": "FIRST_JOURNAL", "name": "First Journal Entry", "description": "Wrote your first journal entry.", "icon": "📓"},
    {"id": "STREAK_7", "name": "7 Day Streak", "description": "Checked in for 7 consecutive days.", "icon": "🔥"},
    {"id": "STREAK_30", "name": "30 Day Streak", "description": "Checked in for 30 consecutive days.", "icon": "🏆"},
    {"id": "FIRST_THERAPY", "name": "First Therapy Session", "description": "Completed your first therapy session.", "icon": "💬"},
    {"id": "THERAPY_5", "name": "5 Therapy Sessions", "description": "Completed 5 therapy sessions.", "icon": "🧠"},
    {"id": "MOOD_MASTER", "name": "Mood Master", "description": "Tracked mood 10 times.", "icon": "🎭"},
    {"id": "WELLNESS_EXPLORER", "name": "Wellness Explorer", "description": "Engaged with multiple wellness features.", "icon": "🌟"},
    {"id": "REFERRAL_CHAMPION", "name": "Referral Champion", "description": "Referred your first friend.", "icon": "🤝"}
]

@router.get("/profile")
async def get_gamification_profile(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Stats
    journal_count = db.query(JournalEntry).filter(JournalEntry.user_id == user_id).count()
    therapy_count = db.query(ChatSession).filter(ChatSession.user_id == user_id).count()
    
    # Check and award badges dynamically
    earned_badges = [b.badge_type for b in db.query(UserBadge).filter(UserBadge.user_id == user_id).all()]
    new_badges = []
    
    # Logic for awarding basic badges
    if journal_count >= 1 and "FIRST_JOURNAL" not in earned_badges:
        new_badges.append("FIRST_JOURNAL")
    if therapy_count >= 1 and "FIRST_THERAPY" not in earned_badges:
        new_badges.append("FIRST_THERAPY")
    if therapy_count >= 5 and "THERAPY_5" not in earned_badges:
        new_badges.append("THERAPY_5")
        
    # Check mood master
    moods = sum(1 for j in db.query(JournalEntry).filter(JournalEntry.user_id == user_id).all() if j.mood) + sum(1 for c in db.query(ChatSession).filter(ChatSession.user_id == user_id).all() if c.mood)
    if moods >= 10 and "MOOD_MASTER" not in earned_badges:
        new_badges.append("MOOD_MASTER")
        
    for nb in new_badges:
        badge = UserBadge(id=str(uuid.uuid4()), user_id=user_id, badge_type=nb, earned_at=time.strftime('%Y-%m-%dT%H:%M:%SZ'))
        db.add(badge)
        earned_badges.append(nb)
    
    if new_badges:
        db.commit()
        
    all_badges = []
    for b in BADGES:
        all_badges.append({
            **b,
            "earned": b["id"] in earned_badges
        })
        
    transactions = db.query(RewardTransaction).filter(RewardTransaction.user_id == user_id).order_by(RewardTransaction.created_at.desc()).all()
    tx_list = [{"reason": t.reason, "points": t.points, "date": t.created_at} for t in transactions]
    
    return {
        "data": {
            "reward_points": user.reward_points or 0,
            "referral_code": user.referral_code,
            "badges": all_badges,
            "stats": {
                "journal_count": journal_count,
                "therapy_count": therapy_count,
                "mood_tracked": moods
            },
            "transactions": tx_list
        },
        "error": None
    }

@router.post("/award")
async def award_points(req: dict, authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ")[1]
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    reason = req.get("reason")
    points = req.get("points", 0)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.reward_points = (user.reward_points or 0) + points
    
    tx = RewardTransaction(
        id=str(uuid.uuid4()),
        user_id=user_id,
        reason=reason,
        points=points,
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(tx)
    db.commit()
    
    return {"data": {"reward_points": user.reward_points}, "error": None}
