export type Language = 'English' | 'Urdu' | 'Roman Urdu' | 'Sindhi' | 'Pashto' | 'Siraiki' | 'Arabic' | 'Spanish';
export type TonePreference = 'Cute' | 'Mature' | 'Friendly' | 'Soft' | 'Calm' | 'Direct';
export type Gender = 'Male' | 'Female' | 'Other' | 'Prefer not to say';
export type Profession = 'Client' | 'Working Professional' | 'Both' | 'Other';
export type TherapistStyle = 'gentle' | 'cbt' | 'mindfulness';
export type PersonalityMode = 'introvert' | 'extrovert';

export interface Badge {
    id: string;
    label: string;
    description: string;
    icon: string;
    requiredDays: number;
    unlockedAt?: number;
    isUnlocked?: boolean; // UI convenience
}

export interface UserStats {
    totalActiveDays: number;
    lastActiveDate: string;
    badges: Badge[];
    applicationStatus?: 'pending' | 'rejected'; // For therapists
}

export interface UserSettings {
    id: string;
    email: string;
    name: string;
    is_anonymous: boolean;
    age: number;
    region: string;
    gender: string;
    profession: string;
    preferredLanguage: Language;
    tonePreference: TonePreference;
    voiceEnabled: boolean;
    autoPlayAudio: boolean;
    memoryEnabled: boolean;
    therapistStyle: TherapistStyle;
    personalityMode: PersonalityMode;
    darkMode: boolean;
    isAdmin?: boolean;
    role: 'patient' | 'therapist' | 'admin' | 'staff';
    accountType?: 'client-demo';
    accountStatus: 'active' | 'suspended' | 'pending' | 'banned';
    suspensionReason?: string;
    stats: UserStats;
    deepMode?: boolean; // For Gemini 3 Pro
}

export interface Memory {
    id: string;
    content: string;
    tags: string[];
    createdAt: number;
    isCore: boolean;
    score?: number;
}

export enum MessageRole {
    USER = 'user',
    MODEL = 'model',
    SYSTEM = 'system'
}

export interface Message {
    id: string;
    role: MessageRole | string;
    text: string;
    timestamp: number;
    audioBase64?: string;
    groundingLinks?: string[];
    referralTherapists?: any[]; // For crisis referrals
    riskLevel?: string;
}

export type Mood = 'happy' | 'calm' | 'neutral' | 'sad' | 'anxious' | 'frustrated';

export interface Session {
    id: string;
    startTime: number;
    endTime: number;
    messages: Message[];
    moodStart?: Mood;
}

export interface JournalEntry {
    id: string;
    title: string;
    content: string;
    mood: string;
    timestamp: number;
}

export interface SessionRating {
    id: string;
    sessionId: string;
    rating: number;
    remark: string;
    timestamp: number;
}

export interface BugReport {
    id: string;
    userId: string;
    sessionId: string;
    issueType: 'Technical Issue' | 'Wrong Response' | 'Slow Response' | 'UI/Design Problem' | 'Other';
    description: string;
    capturedContext?: any[];
    deviceInfo?: string;
    browser?: string;
    appVersion?: string;
    timestamp: number;
    status: 'new' | 'investigating' | 'resolved';
}

export interface UserFeedback {
    id: string;
    userId: string;
    feedbackType: 'Positive' | 'Neutral' | 'Negative';
    category: 'User Experience' | 'Design/UI' | 'Features' | 'Accuracy of Responses' | 'Overall Satisfaction';
    note: string;
    timestamp: number;
    status?: string;
    metadata?: any;
}

export interface Broadcast {
    id: string;
    title: string;
    message: string;
    type: BroadcastType;
    audience: BroadcastAudience;
    sentAt: number;
    expiresAt?: number;
}

export type BroadcastType = 'info' | 'warning' | 'critical' | 'marketing' | 'sales';
export type BroadcastAudience = 'all' | 'therapists' | 'clients';

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'meeting' | 'chat' | 'system' | 'alert' | 'info' | 'warning' | 'critical' | 'marketing' | 'sales';
    isRead: boolean;
    createdAt: number;
}

export type SystemNotification = Notification;

// Therapist & Admin Types

export interface Therapist {
    id: string;
    name: string;
    email: string;
    imageUrl?: string;
    specialty: string;
    location?: string;
    bio: string;
    languages: string[];
    experience: number;
    rating: number;
    reviewCount: number;
    availableSlots?: { day: string; time: string }[];
    bookingUrl: string;
    status: 'LIVE' | 'PENDING' | 'SUSPENDED' | 'OFFLINE';
    isCrisisCertified?: boolean;
    licenseNumber?: string;
    bankDetails?: { bankName: string; accountTitle: string; iban: string };
    notificationPrefs?: { email: boolean; sms: boolean };
    clinicalSpecializations?: string[];
    loyaltyPoints?: number;
    badges?: { id: string; label: string; icon: string; description: string; isUnlocked: boolean }[];
    cvFileName?: string;
    degreeFileName?: string;
    isPro?: boolean;
    boostLevel?: 'basic' | 'professional' | null;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    pricing45?: number;
    pricing60?: number;
    pricing90?: number;
    offerVideo?: boolean;
    offerChat?: boolean;
    bankDetailsLocked?: boolean;
    violationStrikes?: number;
}

export interface TherapistApplication {
    id: string;
    userId: string;
    fullName: string;
    email: string;
    phone: string;
    yearsExperience: number;
    specialization: string;
    licenseNumber: string;
    cvFileName: string; // Path in storage
    degreeFileName: string; // Path in storage
    status: 'pending' | 'approved' | 'rejected';
    submittedAt: number;
    reviewedAt?: number;
    reviewedBy?: string;
}

export interface MarketingExpense {
    id: string;
    platform: 'Facebook' | 'Google' | 'Instagram' | 'Influencer' | 'Server' | 'Other';
    amount: number;
    date: number;
    description: string;
}

export interface FinanceStats {
    revenue: number;
    profit: number;
    marketing: number;
    net_income: number;
    pending_payouts: number;
    cleared_payouts: number;
    top_therapist: { name: string; total: number };
    top_client: { name: string; total: number };
    most_active: { name: string; sessions: number };
}

export interface PayoutRequest {
    id: string;
    therapistId: string;
    therapistName?: string;
    amount: number;
    status: 'Pending' | 'Processed' | 'Rejected';
    requestDate: number;
    method?: string;
    processedAt?: number;
}

export interface AdminStats {
    totalUsers: number;
    activeUsersToday: number;
    totalSessions: number;
    activeTherapists: number;
    totalRevenue: number;
}

export interface AdminUserView {
    id: string;
    name: string;
    email: string;
    age: number;
    gender: string;
    region: string;
    profession: string;
    riskLevel: 'low' | 'moderate' | 'critical';
    status: 'active' | 'suspended';
    lastActive?: string;
}

export interface AdminAlert {
    id: string;
    type: 'High Risk' | 'Policy Violation' | 'Support Request';
    message: string;
    userId: string;
    userName: string;
    timestamp: number;
    status: 'New' | 'Investigating' | 'Resolved';
    triggerKeyword?: string;
}

export interface Transaction {
    id: string;
    date: string; // ISO date
    description: string;
    type: 'Credit' | 'Debit';
    amount: number;
    status: 'Verified' | 'Pending' | 'Processed' | 'Rejected';
    therapistPayout: number; // Net amount after commission if credit
}

export interface Investment {
    id: string;
    investorName: string;
    amount: number;
    date: string;
    equity: number;
}

export interface ChatThread {
    id: string;
    participants: string[];
    lastMessage: string;
    lastMessageAt: number;
}

export interface SystemHealth {
    status: 'Healthy' | 'Degraded' | 'Down';
    apiErrors: number;
    latency: number;
    database: 'Online' | 'Offline';
}

export interface MonetizationConfig {
    commissionRate: number;
    payoutCycleDays: number;
}

export interface TherapistConnection {
    id: string;
    therapistId: string;
    therapistName: string;
    clientId: string;
    clientName: string;
    status: 'ACTIVE' | 'DISPUTED' | 'ENDED';
    totalSessions: number;
    lastMeeting: string;
    meetingLink?: string;
    chatExpiresAt?: string;
}


export type TeamRole = 'Super Admin' | 'Accountant' | 'Moderator' | 'Viewer' | 'Team Member';

export interface TeamPermissions {
    users: 'full' | 'read' | 'none';
    therapists: 'full' | 'read' | 'none';
    finance: 'full' | 'read' | 'none';
    chat: 'full' | 'read' | 'none';
    system: 'full' | 'read' | 'none' | 'locked';
}

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: TeamRole;
    status: 'Active' | 'Suspended' | 'Expired';
    is_active: boolean;
    access_expires_at?: string | null;
    lastLogin: number;
    addedAt: number;
    permissions: TeamPermissions;
    password?: string; // For mock display
}

export interface CompanyExpense {
    id: string;
    category: string;
    amount: number;
    date: number;
    notes: string;
}

export interface TherapyNote {
    id: string;
    userId: string;
    therapistId: string;
    title: string;
    details: string;
    markType: 'Progress' | 'Warning' | 'Needs Follow-up';
    dateOfNote: string;
    createdAt: number;
    nextReminder: string;
}

export interface SupportTicket {
    id: string;
    userId: string;
    userName?: string;
    userEmail?: string;
    type: 'Payment Issue' | 'Booking Issue' | 'Therapist Issue' | 'Technical Issue' | 'Account Verification' | 'Refund Request' | 'General Inquiry';
    priority: 'Low' | 'Medium' | 'High';
    subject: string;
    description: string;
    imageUrl?: string;
    status: 'Open' | 'In Progress' | 'Waiting for User' | 'Resolved' | 'Closed';
    timestamp: number;
    created_at: string; // ISO String
    admin_response?: string;
}

export interface SupportTicketMessage {
    id: string;
    ticket_id: string;
    sender_id: string;
    sender_name: string;
    sender_type: 'user' | 'admin';
    content: string;
    created_at: string;
}

export interface Review {
    id: string;
    therapistId: string;
    clientName: string;
    rating: number;
    feedback: string;
    date: string;
    reply?: string; // Added therapist reply option
}

export interface CalendarSlot {
    id: string;
    therapistId?: string;
    date: string;
    time: string;
    duration: number;
    status: 'available' | 'booked' | 'pending';
    clientName?: string;
    type?: string;
}

export interface SafetyIncident {
    id: string;
    therapistId: string;
    clientName: string;
    type: 'Self-Harm / Suicide Risk (High Priority)' | 'Harassment / Abusive Language' | 'Privacy Violation' | 'Inappropriate Behavior';
    timeOfIncident: string;
    description: string;
    status: 'Reported' | 'Under Review' | 'Resolved';
    timestamp: number;
}

export interface RiskAlert {
    id: string;
    clientId: string;
    clientName: string;
    triggerKeyword: string;
    detectedAt: number;
    status: 'Active' | 'Resolved' | 'Handling';
    message?: string;
    assignedTherapistId?: string;
    assignmentStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
    assignedAt?: string;
    responseDeadline?: string;
    followupStatus?: 'active' | 'completed' | 'escalated';
}

export interface SessionBooking {
    id: string;
    clientId: string;
    therapistId: string;
    sessionType: 'audio' | 'video' | 'chat';
    date: string;
    timeSlot: string;
    duration: number;
    fee: number;
    status: 'Draft' | 'Pending Payment' | 'Payment Under Review' | 'Payment Approved' | 'Payment Rejected' | 'Therapist Assigned' | 'Session Confirmed' | 'Session Completed' | 'Cancelled';
    paymentScreenshot?: string | null;
    transactionId?: string | null;
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface TherapistBoost {
    id: string;
    therapistId: string;
    packageType: 'basic' | 'professional';
    durationDays: number;
    cost: number;
    status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Expired';
    paymentScreenshot?: string | null;
    createdAt?: string;
    expiresAt?: string | null;
}

export interface TherapistSubscription {
    id: string;
    therapistId: string;
    planType: 'pro';
    cost: number;
    status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Expired';
    paymentScreenshot?: string | null;
    createdAt?: string;
    expiresAt?: string | null;
}

