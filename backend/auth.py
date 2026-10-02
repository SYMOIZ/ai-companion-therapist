import hmac
import hashlib
import base64
import json
import time
from fastapi import Header, HTTPException, Depends, status
from sqlalchemy.orm import Session
from .database import get_db
from .models import User

SECRET_KEY = b"sukoon-fastapi-secure-key"

def generate_token(user_id: str) -> str:
    payload = {"user_id": user_id, "exp": time.time() + 30 * 24 * 3600}
    payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
    sig = hmac.new(SECRET_KEY, payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64};.{sig}"

def verify_token(token: str) -> str:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        expected_sig = hmac.new(SECRET_KEY, payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(base64.b64decode(payload_b64).decode())
        if payload["exp"] < time.time():
            return None
        return payload["user_id"]
    except Exception:
        return None

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication credentials"
        )
    token = authorization.split(" ")[1]
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tokens have expired or are invalid"
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authenticated user profile not found"
        )
    return user
