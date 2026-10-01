import { SUKOON_SYSTEM_PROMPT, CRISIS_KEYWORDS } from "../constants";
import { aiMemoryService } from "./aiMemoryService"; 
import { TherapistStyle, PersonalityMode, Gender, Profession, TonePreference, Language } from "../types";

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export const classifyMessageRisk = (text: string): RiskLevel => {
  if (!text || typeof text !== 'string') return 'LOW';
  const clean = text.toLowerCase().trim();
  
  if (
    clean.includes("end my life tonight") ||
    clean.includes("kill myself tonight") ||
    clean.includes("end my life now") ||
    clean.includes("kill myself now") ||
    clean.includes("suicide tonight") ||
    clean.includes("die tonight")
  ) {
    return 'CRITICAL';
  }
  
  if (
    clean.includes("don't want to live") ||
    clean.includes("don't want to live anymore") ||
    clean.includes("want to end my life") ||
    clean.includes("kill myself") ||
    clean.includes("suicide") ||
    clean.includes("want to die") ||
    clean.includes("hurt myself") ||
    clean.includes("better off dead")
  ) {
    return 'HIGH';
  }
  
  if (
    clean.includes("hopeless") || 
    clean.includes("alone") || 
    clean.includes("depressed") || 
    clean.includes("miserable") || 
    clean.includes("empty")
  ) {
    return 'MEDIUM';
  }
  
  return 'LOW';
};

export const checkForCrisis = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  const lowerText = text.toLowerCase();
  return CRISIS_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

interface ChatResponse {
  text: string;
  audioBase64?: string;
  groundingLinks?: string[];
}

const safeString = (val: any) => {
    if (typeof val === 'string') return val;
    if (val === null || val === undefined) return "";
    if (typeof val === 'object') {
        try { return JSON.stringify(val); } catch(e) { return ""; }
    }
    return String(val);
};

const buildSystemInstruction = (
  userProfile: {
      name: string;
      age: number;
      gender: Gender;
      profession: Profession;
      language: Language;
      tone: TonePreference;
      isAdmin?: boolean;
  },
  style: TherapistStyle,
  personality: PersonalityMode,
  memoryContext: string
) => {
    const mode = userProfile.isAdmin ? 'mode: "admin"' : 'mode: "user"';

    const personalContext = `
  USER PROFILE:
  - Name: ${safeString(userProfile.name)}
  - Age: ${safeString(userProfile.age)}
  - Gender: ${safeString(userProfile.gender)}
  - Profession: ${safeString(userProfile.profession)}
  - Tone Preference: ${safeString(userProfile.tone)}
  - Preferred Language: ${safeString(userProfile.language)}
  `;

  const multilingualRules = `
  MULTILINGUAL RULES:
  - Detect the language of the user's message automatically.
  - If they write in ${safeString(userProfile.language)}, reply in ${safeString(userProfile.language)}.
  - If they mix languages (e.g. English + Urdu), reply in the dominant language.
  - Support: English, Urdu, Roman Urdu, Sindhi, Pashto, Siraiki, Arabic, Spanish.
  `;

  return `
  ${SUKOON_SYSTEM_PROMPT}

  CURRENT OPERATION PARAMETER:
  ${mode}

  ${userProfile.isAdmin ? '' : personalContext}
  ${userProfile.isAdmin ? '' : multilingualRules}

  ${userProfile.isAdmin ? '' : memoryContext}
  `;
}

export const generateTherapistResponse = async (
  userId: string,
  history: { role: string; text: string }[],
  latestUserMessage: string,
  userProfile: {
      name: string;
      age: number;
      gender: Gender;
      profession: Profession;
      language: Language;
      tone: TonePreference;
      isAdmin?: boolean;
      deepMode?: boolean;
  },
  userLocation?: { lat: number; lng: number },
  style: TherapistStyle = 'gentle',
  personality: PersonalityMode = 'introvert',
  memoryEnabled: boolean = true
): Promise<ChatResponse> => {
  
  let memoryContext = "";
  
  // 1. RETRIEVAL PIPELINE (Read Path)
  if (memoryEnabled && !userProfile.isAdmin) {
      try {
          const timeoutPromise = new Promise<string>((_, reject) => 
               setTimeout(() => reject(new Error("Memory retrieval timed out (>1000ms)")), 1000)
          );
          const retrievalPromise = aiMemoryService.retrieveContext(userId, latestUserMessage);
          memoryContext = await Promise.race([retrievalPromise, timeoutPromise]);
      } catch (err) {
          console.warn("Memory retrieval timed out or failed (>1000ms), skipping memory context:", err);
          memoryContext = "";
      }
      
      // 2. INGESTION PIPELINE (Write Path)
      if (latestUserMessage.length > 20) {
          // Fire and forget storage
          aiMemoryService.storeMemory(userId, latestUserMessage, 'chat_log').catch(e => console.error("Memory Store Error", e));
      }
  }

  const systemInstruction = buildSystemInstruction(userProfile, style, personality, memoryContext);

  // Tools Configuration
  const toolConfig: any = {};
  const tools: any[] = [];

  // Maps Grounding - Only for non-admin, non-deep mode
  if (userLocation && !userProfile.deepMode && !userProfile.isAdmin) {
      tools.push({ googleMaps: {} });
      toolConfig.retrievalConfig = {
          latLng: {
              latitude: userLocation.lat,
              longitude: userLocation.lng
          }
      };
  }

  try {
    let modelName = 'gemini-2.5-flash';
    let config: any = {
        systemInstruction: systemInstruction,
    };

    if (userProfile.deepMode && !userProfile.isAdmin) {
        modelName = 'gemini-2.5-flash'; // Unified flash model in proxy configuration
    } else {
        config.tools = tools.length > 0 ? tools : undefined;
        config.toolConfig = tools.length > 0 ? toolConfig : undefined;
    }

    // Sanitized history
    const cleanHistory = history
      .map(m => {
        let txt = safeString(m.text);
        if (txt.includes('[object Object]')) return null; // Redact corrupted history
        
        return {
            role: m.role,
            parts: [{ text: txt }] 
        };
      })
      .filter(Boolean) as { role: string, parts: { text: string }[] }[];

    const responseSec = await fetch('/api/engine/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        contents: [
          ...cleanHistory,
          { role: 'user', parts: [{ text: latestUserMessage }] }
        ],
        config: config
      })
    });
    
    const textSec = await responseSec.text();
    let resultSec;
    try {
        resultSec = JSON.parse(textSec);
    } catch (err) {
        throw new Error("Failed to parse AI response. Received invalid JSON from server: " + textSec.substring(0, 100));
    }
    
    if (resultSec.error) {
        throw new Error(resultSec.error);
    }

    return {
      text: resultSec.text || "I am listening. Please share more.",
      groundingLinks: undefined
    };

  } catch (error) {
    console.error("Engine API Error:", error);
    return { text: "I'm having a moment of connection trouble, but I'm here." };
  }
};

export const generateSpeech = async (text: string): Promise<string | undefined> => {
    try {
        const safeText = safeString(text);
        if (safeText.includes('[object Object]')) return undefined;

        const response = await fetch('/api/engine/speech', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ text: safeText })
        });
        if (!response.ok) return undefined;
        
        const rawText = await response.text();
        let result;
        try {
            result = JSON.parse(rawText);
        } catch (err) {
            console.error("TTS JSON parse failed", rawText.substring(0, 100));
            return undefined;
        }
        return result.data || undefined;
    } catch (e) {
        console.error("TTS generation failed", e);
        return undefined;
    }
}

export const transcribeAudio = async (audioBase64: string, mimeType: string = 'audio/wav'): Promise<string> => {
    try {
         const response = await fetch('/api/engine/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64, mimeType })
         });
         if (!response.ok) return "";
         
         const rawText = await response.text();
         let result;
         try {
             result = JSON.parse(rawText);
         } catch (err) {
             console.error("Transcription JSON parse failed", rawText.substring(0, 100));
             return "";
         }
         return result.text || "";
    } catch (e) {
        console.error("Transcription failed", e);
        return "";
    }
};
