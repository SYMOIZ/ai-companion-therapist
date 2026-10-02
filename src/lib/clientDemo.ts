import { JournalEntry, Message } from '../types';

export const CLIENT_DEMO_USER_ID = 'client-demo-001';
export const CLIENT_DEMO_EMAIL = 'demo.client@sukoon.ai';
export const CLIENT_DEMO_NAME = 'Demo Account';
export const CLIENT_DEMO_UPGRADE_KEY = 'sukoon_client_demo_upgrade';
export const CLIENT_DEMO_SESSION_KEY = 'sukoon_client_demo_session';
const DEMO_CHAT_KEY = 'sukoon_client_demo_chat';
const DEMO_JOURNAL_KEY = 'sukoon_client_demo_journal';

export const isClientDemoAccount = (user?: { id?: string; email?: string; accountType?: string } | null) => {
  if (!user) return false;
  if (user.accountType === 'client-demo') return true;
  if (user.id === CLIENT_DEMO_USER_ID) return true;
  return (user.email || '').trim().toLowerCase() === CLIENT_DEMO_EMAIL;
};

export const startClientDemoSession = () => {
  sessionStorage.setItem(CLIENT_DEMO_SESSION_KEY, crypto.randomUUID());
  sessionStorage.removeItem(DEMO_CHAT_KEY);
  sessionStorage.removeItem(DEMO_JOURNAL_KEY);
};

export const clientDemoSessionId = () => sessionStorage.getItem(CLIENT_DEMO_SESSION_KEY) || '';

export const clearClientDemoSession = () => {
  sessionStorage.removeItem(CLIENT_DEMO_SESSION_KEY);
  sessionStorage.removeItem(DEMO_CHAT_KEY);
  sessionStorage.removeItem(DEMO_JOURNAL_KEY);
};

export const redirectClientDemoToSignup = (user?: { id?: string; email?: string; accountType?: string } | null) => {
  if (!isClientDemoAccount(user)) return false;
  sessionStorage.setItem(CLIENT_DEMO_UPGRADE_KEY, '1');
  clearClientDemoSession();
  localStorage.removeItem('sukoon_current_user');
  localStorage.removeItem('sukoon_auth_token');
  window.location.assign('/');
  return true;
};

export const readDemoChat = (): Message[] => {
  try {
    const raw = sessionStorage.getItem(DEMO_CHAT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const writeDemoChat = (messages: Message[]) => {
  sessionStorage.setItem(DEMO_CHAT_KEY, JSON.stringify(messages));
};

export const readDemoJournal = (): JournalEntry[] => {
  try {
    const raw = sessionStorage.getItem(DEMO_JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const writeDemoJournal = (entries: JournalEntry[]) => {
  sessionStorage.setItem(DEMO_JOURNAL_KEY, JSON.stringify(entries));
};

export const syncClientDemoUsage = async (action: 'status' | 'consume') => {
  const sessionId = clientDemoSessionId();
  const response = await fetch('/api/auth/demo-client-usage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('sukoon_auth_token') || ''}`
    },
    body: JSON.stringify({ sessionId, action })
  });
  if (!response.ok) {
    return { allowed: false, count: 0, limit: 10 };
  }
  return response.json();
};
