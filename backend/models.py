from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class UserPassword(Base):
    __tablename__ = "user_passwords"
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    password = Column(String, nullable=False)

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String)
    role = Column(String, default="patient")
    account_status = Column(String, default="active")
    age = Column(Integer)
    gender = Column(String)
    region = Column(String)
    profession = Column(String)
    preferred_language = Column(String, default="English")
    tone_preference = Column(String, default="Friendly")
    voice_enabled = Column(Integer, default=0)
    auto_play_audio = Column(Integer, default=0)
    memory_enabled = Column(Integer, default=1)
    therapist_style = Column(String, default="gentle")
    personality_mode = Column(String, default="introvert")
    dark_mode = Column(Integer, default=1)
    is_admin = Column(Integer, default=0)
    suspension_reason = Column(String)
    profile_picture_url = Column(String)
    cover_image_url = Column(String)
    bio = Column(String)
    is_public_profile = Column(Integer, default=0)
    referral_code = Column(String, unique=True, index=True)
    referred_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reward_points = Column(Integer, default=0)
    created_at = Column(String)
    updated_at = Column(String)

class TherapistProfile(Base):
    __tablename__ = "therapist_profiles"
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    specialty = Column(String)
    bio = Column(String)
    languages = Column(String, default='["English"]')
    experience = Column(Integer, default=0)
    rating = Column(Float, default=5.0)
    review_count = Column(Integer, default=0)
    booking_url = Column(String)
    is_crisis_certified = Column(Integer, default=0)
    license_number = Column(String)
    bank_details = Column(String, default='{}')
    notification_prefs = Column(String, default='{"email": true, "sms": false}')
    clinical_specializations = Column(String, default='[]')
    loyalty_points = Column(Integer, default=0)
    approval_status = Column(String, default="pending")
    pricing_45 = Column(Float, default=0.0)
    pricing_60 = Column(Float, default=0.0)
    pricing_90 = Column(Float, default=0.0)
    offer_video = Column(Integer, default=1)
    offer_chat = Column(Integer, default=1)
    bank_details_locked = Column(Integer, default=0)
    violation_strikes = Column(Integer, default=0)
    updated_at = Column(String)

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mood = Column(String)
    created_at = Column(String)
    updated_at = Column(String)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    meta_data = Column("metadata", Text, default="{}")
    created_at = Column(String)

class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = {'keep_existing': True}
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title = Column(String)
    content = Column(Text, nullable=False)
    mood = Column(String)
    created_at = Column(String)

class UserMemory(Base):
    __tablename__ = "user_memory"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content = Column(Text, nullable=False)
    embedding = Column(Text)  # stored as JSON array of floats
    source_type = Column(String, default="chat_log")
    meta_data = Column("metadata", Text, default="{}")
    created_at = Column(String)

class SystemSetting(Base):
    __tablename__ = "system_settings"
    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    updated_at = Column(String)

class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_email = Column(String)
    user_name = Column(String)
    type = Column(String)
    priority = Column(String, default="Low")
    subject = Column(String, nullable=False)
    description = Column(String)
    image_url = Column(String)
    status = Column(String, default="Open")
    admin_response = Column(String)
    resolved_at = Column(String)
    created_at = Column(String)

class SupportTicketMessage(Base):
    __tablename__ = "support_ticket_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column(String, ForeignKey("support_tickets.id", ondelete="CASCADE"), index=True)
    sender_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sender_name = Column(String)
    sender_type = Column(String) # 'user' or 'admin'
    content = Column(Text, nullable=False)
    created_at = Column(String)

class Review(Base):
    __tablename__ = "reviews"
    id = Column(String, primary_key=True)
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    client_name = Column(String)
    rating = Column(Integer)
    comment = Column(Text)
    status = Column(String, default="pending")
    created_at = Column(String)

class SessionRating(Base):
    __tablename__ = "session_ratings"
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    rating = Column(Integer)
    remark = Column(Text)
    created_at = Column(String)

class BugReport(Base):
    __tablename__ = "bug_reports"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="SET NULL"), nullable=True)
    issue_type = Column(String, nullable=False)
    description = Column(Text)
    device_info = Column(String)
    status = Column(String, default="new")
    created_at = Column(String)

class UserFeedback(Base):
    __tablename__ = "user_feedback"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    feedback_type = Column(String, nullable=False)
    category = Column(String, nullable=False)
    note = Column(Text)
    status = Column(String, default="Pending")
    meta_data = Column("metadata", Text, default="{}")
    created_at = Column(String)

class RiskAlert(Base):
    __tablename__ = "risk_alerts"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    client_name = Column(String)
    trigger_keyword = Column(String)
    message = Column(Text)
    detected_at = Column(String)
    status = Column(String, default="Active")
    assigned_therapist_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assignment_status = Column(String, default="none") # 'none', 'pending', 'accepted', 'rejected'
    assigned_at = Column(String, nullable=True)
    response_deadline = Column(String, nullable=True)
    followup_status = Column(String, nullable=True) # 'active', 'completed', 'escalated'


class SafetyIncident(Base):
    __tablename__ = "safety_incidents"
    id = Column(String, primary_key=True)
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    client_name = Column(String)
    incident_type = Column(String, nullable=False)
    description = Column(Text)
    time_of_incident = Column(String)
    status = Column(String, default="Reported")
    created_at = Column(String)

class EmergencySession(Base):
    __tablename__ = "emergency_sessions"
    id = Column(String, primary_key=True)
    alert_id = Column(String, ForeignKey("risk_alerts.id", ondelete="CASCADE"))
    client_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    started_at = Column(String)

class CalendarSlot(Base):
    __tablename__ = "calendar_slots"
    id = Column(String, primary_key=True)
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    date = Column(String, nullable=False)
    time = Column(String, nullable=False)
    duration = Column(Integer, default=60)
    status = Column(String, default="available")
    client_name = Column(String)
    session_type = Column(String)

class TeamMember(Base):
    __tablename__ = "team_members"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    role = Column(String, nullable=False)
    status = Column(String, default="Active")
    permissions = Column(Text, default="{}")
    access_expires_at = Column(String)
    last_login = Column(String)
    created_at = Column(String)

class Broadcast(Base):
    __tablename__ = "broadcasts"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, nullable=False)
    audience = Column(String, nullable=False)
    sent_at = Column(String)

class ChatViolation(Base):
    __tablename__ = "chat_violations"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    message_content = Column(Text)
    violation_type = Column(String)
    status = Column(String, default="warning")
    created_at = Column(String)

class DirectMessage(Base):
    __tablename__ = "direct_messages"
    id = Column(String, primary_key=True)
    sender_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    receiver_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    content = Column(Text, nullable=False)
    created_at = Column(String)

class TherapistConnection(Base):
    __tablename__ = "therapist_connections"
    id = Column(String, primary_key=True)
    client_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    status = Column(String, default="active")
    notes = Column(Text)
    config = Column(Text, default="{}")
    meeting_link = Column(String)
    chat_expires_at = Column(String)
    created_at = Column(String)

class TherapyNote(Base):
    __tablename__ = "therapy_notes"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String)
    details = Column(Text)
    mark_type = Column(String)
    date_of_note = Column(String)
    next_reminder = Column(String)
    created_at = Column(String)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String)
    message = Column(String)
    type = Column(String, default="system")
    is_read = Column(Integer, default=0)
    created_at = Column(String)

class MarketingExpense(Base):
    __tablename__ = "marketing_expenses"
    id = Column(String, primary_key=True)
    platform = Column(String, nullable=False)
    amount = Column(Float, default=0.0)
    description = Column(String)
    date = Column(String)

class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    therapist_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    client_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Float, default=0.0)
    type = Column(String, nullable=False)
    status = Column(String, default="Pending")
    description = Column(String)
    therapist_payout = Column(Float, default=0.0)
    date = Column(String)

class PayoutRequest(Base):
    __tablename__ = "payout_requests"
    id = Column(String, primary_key=True)
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    therapist_name = Column(String)
    amount = Column(Float, default=0.0)
    status = Column(String, default="Pending")
    request_date = Column(String)
    method = Column(String)
    processed_at = Column(String)

class AdminAction(Base):
    __tablename__ = "admin_actions"
    id = Column(String, primary_key=True)
    admin_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String, nullable=False)
    details = Column(Text, default="{}")
    created_at = Column(String)

class EmailEvent(Base):
    __tablename__ = "email_events"
    id = Column(String, primary_key=True)
    to_email = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    body = Column(Text)
    event_type = Column(String, nullable=False)
    status = Column(String, default="pending")
    created_at = Column(String)

class TherapistApplication(Base):
    __tablename__ = "therapist_applications"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String)
    years_experience = Column(Integer, default=0)
    specialization = Column(String)
    license_number = Column(String)
    cv_file = Column(String)
    degree_file = Column(String)
    status = Column(String, default="pending")
    submitted_at = Column(String)

class SessionBooking(Base):
    __tablename__ = "session_bookings"
    id = Column(String, primary_key=True)
    client_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    session_type = Column(String)
    date = Column(String)
    time_slot = Column(String)
    duration = Column(Integer, default=60)
    fee = Column(Float, default=0.0)
    status = Column(String, default="Pending")
    payment_screenshot = Column(String)
    transaction_id = Column(String)
    notes = Column(Text)

class TherapistBoost(Base):
    __tablename__ = "therapist_boosts"
    id = Column(String, primary_key=True)
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    tier = Column(String)
    cost = Column(Float)
    clicks = Column(Integer, default=0)
    status = Column(String, default="Active")
    expiry = Column(String)

class TherapistSubscription(Base):
    __tablename__ = "therapist_subscriptions"
    id = Column(String, primary_key=True)
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    plan = Column(String)
    payout_share = Column(Float)
    status = Column(String, default="Active")
    renews_at = Column(String)

class FollowupConversation(Base):
    __tablename__ = "followup_conversations"
    id = Column(String, primary_key=True)
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    patient_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    booking_id = Column(String, ForeignKey("session_bookings.id", ondelete="CASCADE"))
    message_count = Column(Integer, default=0)
    followup_expiry_date = Column(String)
    last_message_at = Column(String)
    status = Column(String, default="ACTIVE")

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False) # Free, Monthly, Yearly, Lifetime
    price = Column(Float, default=0.0)
    duration_months = Column(Integer, default=1)
    is_lifetime = Column(Integer, default=0)
    max_ai_chats = Column(Integer, default=10)
    max_journal_entries = Column(Integer, default=30)
    priority_matching = Column(Integer, default=0)
    premium_features = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(String)

class UserSubscription(Base):
    __tablename__ = "user_subscriptions"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    plan_id = Column(String, ForeignKey("subscription_plans.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, default="Active") # Active, Expired, Pending Validation
    expiry_date = Column(String)
    renewal_date = Column(String)
    created_at = Column(String)
    updated_at = Column(String)

class PurchaseHistory(Base):
    __tablename__ = "purchase_history"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    item_type = Column(String) # "Subscription"
    item_id = Column(String) # plan_id
    amount = Column(Float)
    currency = Column(String, default="PKR")
    status = Column(String, default="Completed") # Pending, Completed, Rejected
    payment_method = Column(String)
    transaction_id = Column(String)
    receipt_url = Column(String)
    created_at = Column(String)

class FollowupRequest(Base):
    __tablename__ = "followup_requests"
    id = Column(String, primary_key=True)
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    patient_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    status = Column(String, default="pending")
    created_at = Column(String)

class PaidChatSupport(Base):
    __tablename__ = "paid_chat_support"
    id = Column(String, primary_key=True)
    patient_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    duration_type = Column(String)
    expires_at = Column(String)
    price = Column(Float)
    created_at = Column(String)

class PaidChatSlaViolation(Base):
    __tablename__ = "paid_chat_sla_violations"
    id = Column(String, primary_key=True)
    patient_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    therapist_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    support_id = Column(String, ForeignKey("paid_chat_support.id", ondelete="CASCADE"))
    last_message_id = Column(String)
    last_message_at = Column(String)
    status = Column(String, default="pending_refund")
    created_at = Column(String)

class UserBadge(Base):
    __tablename__ = "user_badges"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    badge_type = Column(String, nullable=False)
    earned_at = Column(String)

class ReferralReward(Base):
    __tablename__ = "referral_rewards"
    id = Column(String, primary_key=True)
    referrer_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    referred_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    points_awarded = Column(Integer, default=0)
    created_at = Column(String)

class RewardTransaction(Base):
    __tablename__ = "reward_transactions"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    reason = Column(String, nullable=False)
    points = Column(Integer, nullable=False)
    created_at = Column(String)

