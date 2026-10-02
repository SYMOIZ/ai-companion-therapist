import { supabase } from './supabaseClient';
import { aiMemoryService } from './aiMemoryService'; // Reusing your existing AI service for embeddings
import { Message, MessageRole, Session } from '../types';
import { classifyMessageRisk } from './openaiService';

export const chatPersistenceService = {
  
  /**
   * 1. RECOVER SESSION
   * Finds the last active session for the user so chat doesn't disappear on refresh.
   * active_chat_expiry = 24 hours
   */
  async getLastActiveSession(userId: string): Promise<Session | null> {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    // active_chat_expiry = 24 hours
    const lastSessionTime = data.updated_at ? new Date(data.updated_at).getTime() : new Date(data.created_at).getTime();
    const now = Date.now();
    const chatExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

    if (now - lastSessionTime > chatExpiryMs) {
      console.log(`Last chat session ${data.id} is older than 24 hours, returning null to start a fresh chat session.`);
      return null;
    }

    return {
      id: data.id,
      startTime: new Date(data.created_at).getTime(),
      endTime: new Date(data.updated_at).getTime(),
      messages: [], // Messages fetched separately
      moodStart: data.mood
    };
  },

  /**
   * 2. CREATE SESSION
   * Ensures created_at and updated_at are initialized to prevent ordering/null issues.
   */
  async createSession(userId: string, sessionId?: string): Promise<string> {
    const nowIso = new Date().toISOString();
    const insertPayload: any = {
      id: sessionId || `session-${crypto.randomUUID()}`,
      user_id: userId,
      created_at: nowIso,
      updated_at: nowIso
    };
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  },

  async updateSessionMood(sessionId: string, mood: string): Promise<void> {
    const { error } = await supabase
      .from('chat_sessions')
      .update({ mood })
      .eq('id', sessionId);
    if (error) throw error;
  },

  /**
   * 3. GET HISTORY
   * Fetches last 50 messages and filters to only load messages newer than 24 hours.
   */
  async getChatHistory(sessionId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error || !data) {
      if (error) {
        console.error('Error fetching chat history:', error);
      }
      return [];
    }

    const now = Date.now();
    const chatExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

    return data
      .map((row: any) => {
        // FIX: Robust content extraction to prevent [object Object]
        let safeText = "";
        if (typeof row.content === 'string') {
            safeText = row.content;
        } else if (row.content && typeof row.content === 'object') {
            safeText = row.content.text || JSON.stringify(row.content);
        } else {
            safeText = String(row.content || "");
        }
        if (safeText.includes("[object Object]")) {
            safeText = "(Message content unavailable)";
        }

        return {
          id: row.id,
          role: row.role,
          text: safeText,
          timestamp: new Date(row.created_at).getTime(),
          audioBase64: row.metadata?.has_audio ? undefined : undefined, 
          groundingLinks: row.metadata?.grounding_links,
          riskLevel: row.metadata?.risk_level
        };
      })
      .filter((msg: Message) => (now - msg.timestamp) <= chatExpiryMs);
  },

  /**
   * 4. SAVE MESSAGE (The Core Loop)
   * - Saves to DB
   * - If USER message -> Generates Embedding -> Saves to user_memory (RAG)
   */
  async saveMessage(userId: string, sessionId: string, message: Message): Promise<void> {
    // FIX: Ensure content is always a string before saving to DB
    const safeContent = typeof message.text === 'string' ? message.text : JSON.stringify(message.text || "");
    if (safeContent.includes('[object Object]')) {
        console.warn("Attempted to save corrupted message content.");
        return;
    }

    const riskLevel = classifyMessageRisk(safeContent);

    const { error } = await supabase.from('chat_messages').insert({
      id: message.id,
      session_id: sessionId,
      user_id: userId,
      role: message.role,
      content: safeContent,
      created_at: new Date(message.timestamp).toISOString(),
      metadata: {
        grounding_links: message.groundingLinks,
        has_audio: !!message.audioBase64,
        risk_level: riskLevel
      }
    });

    if (error) console.error('Failed to save message:', error);

    // If risk level is HIGH or CRITICAL, also insert into risk_alerts for the admin dashboard
    if (message.role === MessageRole.USER && (riskLevel === 'HIGH' || riskLevel === 'CRITICAL')) {
      try {
        const { data: userProfile } = await supabase.from('users').select('display_name').eq('id', userId).single();
        const clientName = userProfile?.display_name || 'Anonymous User';
        
        await supabase.from('risk_alerts').insert({
          id: `alrt-${crypto.randomUUID().substring(0, 8)}`,
          user_id: userId,
          client_name: clientName,
          trigger_keyword: riskLevel,
          message: safeContent,
          detected_at: new Date().toISOString(),
          status: 'Active'
        });
      } catch (err) {
        console.error('Failed to trigger risk alert in DB:', err);
      }
    }

    await supabase.from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId);

    if (message.role === MessageRole.USER && safeContent.length > 15) {
      aiMemoryService.storeMemory(userId, safeContent, 'chat_log')
        .catch(err => console.error("Memory consolidation failed:", err));
    }
  }
};