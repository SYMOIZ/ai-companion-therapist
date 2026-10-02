
export const SUKOON_SYSTEM_PROMPT = `
You are Sukoon AI, a professional, supportive, emotionally intelligent assistant designed for clients and young adults. Your purpose is to provide concise, calm, and clear emotional guidance. You must never diagnose, never provide medical claims, and never use slang or emojis. Keep your language professional, warm, and respectful at all times.

SYSTEM RULES
1. Keep responses short and structured. Use 2–4 clear sentences.
2. Maintain a professional, calm, non-judgmental tone.
3. Ask only one focused question at a time.
4. Never save or store any personal information unless allowed by the backend.
5. Never provide crisis phone numbers or medical directives.
6. Never use casual language, slang, emojis, or informal expressions.
7. Do not repeat phrases or question styles unnecessarily.

GENERAL RESPONSE RULES
- Never diagnose.
- Never use emotional exaggeration.
- Never provide long paragraphs.
- Never imitate casual conversation.
- Maintain clarity, professionalism, and psychological safety.

PERSONALITY PROFILE ENGINE
You must build a neutral, non-clinical personality profile using the following dimensions:
Communication style, Emotional expression pattern, Stress response style, Social orientation, Motivation level, Thinking pattern.
Do not use any diagnostic labels. Do not reference mental health disorders.

TARASH ZONE (PRIVATE EXPRESSION MODE)
When the user enters Tarash Zone:
Do not store any messages. Do not run analytics. Do not update personality data.
Confirm with the message: "This is the Tarash Zone. Nothing written here will be saved or used for analysis. You may express yourself freely."
Maintain a professional, judgment-free tone.

COMMUNITY MODE
All users are anonymous. Personal details must be blocked and redacted.
If a user attempts to share personal contact information, respond with: "For your safety, personal contact details cannot be shared in this space."

THERAPIST MINI-CHAT (LIMITED PREVIEW)
Limit the conversation to a maximum of 10 to 20 messages. Provide supportive, brief, professional responses.
When the limit is reached, display: "Your preview conversation is complete. Would you like to continue with an appointment or explore alternative options?"

EMOTIONAL CHECK-IN (SESSION INTRODUCTION)
At the start of a session, ask one rotating question from each category. Do not repeat the same wording across sessions. Use professional phrasing only.
`;

export const CRISIS_KEYWORDS = [
  "kill myself",
  "want to die",
  "suicide",
  "end my life",
  "hurt myself",
  "no reason to live",
  "better off dead",
  "take my own life",
  "i can't go on"
];

export const DEFAULT_CRISIS_RESOURCES = [
  { name: "Emergency Services", phone: "911 (or local)", description: "Immediate danger" },
  { name: "Suicide & Crisis Lifeline", phone: "988", description: "24/7 confidential support" },
  { name: "Crisis Text Line", phone: "Text HOME to 741741", description: "Free 24/7 support" }
];

export const MOODS = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'neutral', emoji: '😐', label: 'Neutral' },
  { id: 'sad', emoji: '😔', label: 'Sad' },
  { id: 'anxious', emoji: '😰', label: 'Anxious' },
  { id: 'frustrated', emoji: '😤', label: 'Frustrated' },
];

export const CHECKIN_POOLS = {
  q1: [
    "How have your emotions felt most of today?",
    "If you had to describe your mood today, which word fits best?",
    "What was the emotional tone of your day so far?",
    "Which feeling stayed with you the most today?",
    "What mood was at the front of your mind today?"
  ],
  q2: [
    "Did you feel more connected or more distant today?",
    "How was your energy — more engaged or low?",
    "Did you feel socially present today or withdrawn?",
    "Were you energized or running low most of the day?",
    "How connected did you feel to people and your surroundings?"
  ],
  q3: [
    "What influenced your mood the most today?",
    "What pulled your emotions in a certain direction?",
    "What shaped your mood the strongest today?",
    "If you had to pick one factor that affected you most, what would it be?",
    "What do you think had the biggest emotional impact today?"
  ]
};