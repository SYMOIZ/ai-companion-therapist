from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any

class RegisterSchema(BaseModel):
    email: EmailStr
    password: str
    name: str
    age: int
    region: str
    gender: str
    profession: str
    language: str
    tone: str
    captchaToken: Optional[str] = None

class RegisterTherapistSchema(BaseModel):
    fullName: str
    email: EmailStr
    phone: str
    password: str
    yearsExperience: int
    specialization: str
    licenseNumber: str
    cvFileName: Optional[str] = "Not Provided"
    degreeFileName: Optional[str] = "Not Provided"
    captchaToken: Optional[str] = None

class LoginSchema(BaseModel):
    email: EmailStr
    password: str

class UserUpdateSchema(BaseModel):
    display_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    region: Optional[str] = None
    profession: Optional[str] = None
    preferred_language: Optional[str] = None
    tone_preference: Optional[str] = None
    voice_enabled: Optional[int] = None
    auto_play_audio: Optional[int] = None
    memory_enabled: Optional[int] = None
    therapist_style: Optional[str] = None
    personality_mode: Optional[str] = None
    dark_mode: Optional[int] = None

class BookingCreateSchema(BaseModel):
    therapistId: str
    sessionType: str
    date: str
    timeSlot: str
    duration: int = 60
    fee: float = 0.0
    paymentScreenshot: Optional[str] = ""
    transactionId: Optional[str] = ""
    notes: Optional[str] = ""

class BookingUpdateSchema(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class SupportTicketCreateSchema(BaseModel):
    type: str
    subject: str
    description: str

class BugReportCreateSchema(BaseModel):
    issue_type: str
    description: str
    device_info: Optional[str] = "unknown"
    session_id: Optional[str] = None

class UserFeedbackCreateSchema(BaseModel):
    feedback_type: str
    category: str
    note: str
#updated
class JournalEntryCreateSchema(BaseModel):
    title: Optional[str] = ""
    content: str
    mood: Optional[str] = ""

class MessageCreateSchema(BaseModel):
    role: str
    content: str
    metadata: Optional[Dict[str, Any]] = None

class SpeechRequestSchema(BaseModel):
    text: str

class TranscriptionRequestSchema(BaseModel):
    audio_base64: str
    mime_type: Optional[str] = "audio/wav"

class GeminiGenerateSchema(BaseModel):
    model: Optional[str] = "gemini-2.5-flash"
    contents: List[Dict[str, Any]]
    config: Optional[Dict[str, Any]] = None
