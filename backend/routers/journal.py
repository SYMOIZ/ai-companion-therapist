import uuid
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import JournalEntry, User
from ..schemas import JournalEntryCreateSchema
from ..auth import get_current_user

router = APIRouter(prefix="/api/journals", tags=["journals"])

@router.get("")
async def get_journals(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    entries = db.query(JournalEntry).filter(JournalEntry.user_id == current_user.id).all()
    res = []
    for e in entries:
        res.append({
            "id": e.id,
            "userId": e.user_id,
            "title": e.title,
            "content": e.content,
            "mood": e.mood,
            "createdAt": e.created_at
        })
    return {"data": res, "error": None}

@router.post("/create")
@router.post("")
async def create_journal(req: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Simple wrapper to parse either flat json or journal format
    title = req.get("title", "")
    content = req.get("content", "")
    mood = req.get("mood", "Neutral")
    
    if not content:
        raise HTTPException(status_code=400, detail="Content is required")

    jid = req.get("id") or f"jour-{uuid.uuid4().hex[:12]}"
    new_entry = JournalEntry(
        id=jid,
        user_id=current_user.id,
        title=title,
        content=content,
        mood=mood,
        created_at=time.strftime('%Y-%m-%dT%H:%M:%SZ')
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return {"data": {
        "id": new_entry.id,
        "userId": new_entry.user_id,
        "title": new_entry.title,
        "content": new_entry.content,
        "mood": new_entry.mood,
        "createdAt": new_entry.created_at
    }, "error": None}

@router.delete("/{entryId}")
@router.delete("/delete/{entryId}")
async def delete_journal(entryId: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entryId, JournalEntry.user_id == current_user.id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
        
    db.delete(entry)
    db.commit()
    return {"data": True, "error": None}
