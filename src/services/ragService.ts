
import { Memory, Session, JournalEntry, UserSettings, Badge } from '../types';
import { updateUserProfile } from './authService';
import { supabase } from './supabaseClient';

// --- Memories (Now synced with Supabase via aiMemoryService usually) ---
export const getMemories = async (userId: string): Promise<Memory[]> => {
    const { data } = await supabase.from('user_memory').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    
    return (data || []).map((m: any) => ({
        id: m.id,
        content: m.content,
        tags: [m.source_type],
        createdAt: new Date(m.created_at).getTime(),
        isCore: m.source_type === 'bio'
    }));
};

export const addMemory = async (userId: string, content: string, isCore: boolean = false) => {
    // Deprecated wrapper - direct calls to aiMemoryService preferred in chat
    // But kept for UI compatibility
    return { id: '', content, tags: [], createdAt: Date.now(), isCore };
};

export const deleteMemory = async (userId: string, id: string) => {
    await supabase.from('user_memory').delete().eq('id', id).eq('user_id', userId);
};

// --- Sessions ---
const sessionCache: Record<string, Session[]> = {};

export const getSessions = async (userId: string): Promise<Session[]> => {
    if (sessionCache[userId]) {
        console.log(`[Cache Hit] getSessions for userId=${userId}`);
        return sessionCache[userId];
    }
    // 1. Fetch Sessions
    const { data: sessions } = await supabase.from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (!sessions) return [];

    // 2. Hydrate with Messages (Simplified: Fetching all messages for recent sessions might be heavy, optimized for singular view in real app)
    // For list view, we just return metadata.
    const mapped = sessions.map((s: any) => ({
        id: s.id,
        startTime: new Date(s.created_at).getTime(),
        endTime: new Date(s.updated_at).getTime(),
        moodStart: s.mood,
        messages: [] // Loaded lazily if needed
    }));
    sessionCache[userId] = mapped;
    return mapped;
};

export const clearSessionCache = (userId: string) => {
    delete sessionCache[userId];
};

export const saveSession = async (userId: string, session: Session) => {
    // Handled in dataService.ts
};

// --- Journals ---
const journalCache: Record<string, JournalEntry[]> = {};

export const clearJournalCache = (userId: string) => {
    delete journalCache[userId];
};

export const appendToJournalCache = (userId: string, entry: JournalEntry) => {
    if (journalCache[userId]) {
        journalCache[userId] = [entry, ...journalCache[userId]];
    } else {
        journalCache[userId] = [entry];
    }
};

export const removeFromJournalCache = (entryId: string) => {
    for (const uId of Object.keys(journalCache)) {
        journalCache[uId] = journalCache[uId].filter(e => e.id !== entryId);
    }
};

export const getJournals = async (userId: string): Promise<JournalEntry[]> => {
    if (journalCache[userId]) {
        console.log(`[Cache Hit] getJournals for userId=${userId}`);
        return journalCache[userId];
    }
    const { data } = await supabase.from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    const mapped = (data || []).map((j: any) => ({
        id: j.id,
        title: j.title,
        content: j.content,
        mood: j.mood,
        timestamp: new Date(j.created_at).getTime()
    }));
    journalCache[userId] = mapped;
    return mapped;
};

export const saveJournals = async (userId: string, entries: JournalEntry[]) => {
    // Handled in dataService.ts
};

// --- Deletion Logic ---
export const deleteTodayData = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('chat_messages').delete().eq('user_id', userId).gte('created_at', today);
    await supabase.from('journal_entries').delete().eq('user_id', userId).gte('created_at', today);
};

export const deleteAllData = async (userId: string) => {
    await supabase.from('chat_messages').delete().eq('user_id', userId);
    await supabase.from('journal_entries').delete().eq('user_id', userId);
    await supabase.from('user_memory').delete().eq('user_id', userId);
    await supabase.from('chat_sessions').delete().eq('user_id', userId);
};

export const deleteDateData = async (userId: string, dateStr: string) => {
    // dateStr is YYYY-MM-DD
    const start = `${dateStr}T00:00:00.000Z`;
    const end = `${dateStr}T23:59:59.999Z`;
    
    await supabase.from('journal_entries').delete().eq('user_id', userId).gte('created_at', start).lte('created_at', end);
    await supabase.from('chat_messages').delete().eq('user_id', userId).gte('created_at', start).lte('created_at', end);
};

// --- Streaks & Badges (Updates User Profile directly) ---
export const trackUserActivity = (user: UserSettings): { updatedUser: UserSettings, newBadge?: Badge } => {
    if (!user) return { updatedUser: user };
    const todayStr = new Date().toLocaleDateString('en-CA');
    const userStats = user.stats || {};
    const stats = { 
        totalActiveDays: userStats.totalActiveDays || 0,
        lastActiveDate: userStats.lastActiveDate || '',
        badges: userStats.badges || []
    };

    if (stats.lastActiveDate === todayStr) return { updatedUser: user };

    stats.lastActiveDate = todayStr;
    stats.totalActiveDays = (stats.totalActiveDays || 0) + 1;

    let newBadge: Badge | undefined;
    const badgesArray = Array.isArray(stats.badges) ? stats.badges : [];
    const updatedBadges = badgesArray.map(b => {
        if (b && !b.unlockedAt && stats.totalActiveDays >= b.requiredDays) {
            const unlocked = { ...b, unlockedAt: Date.now() };
            if (!newBadge) newBadge = unlocked;
            return unlocked;
        }
        return b;
    });
    
    stats.badges = updatedBadges;
    const updatedUser = { ...user, stats };
    
    // Persist to DB
    updateUserProfile(updatedUser);
    
    return { updatedUser, newBadge };
};
