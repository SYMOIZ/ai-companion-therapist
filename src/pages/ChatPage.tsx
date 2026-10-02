
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, AlertTriangle, Flag, MessageSquare, 
  Trash2, X, ChevronRight, Heart, Sparkles,
  Smile, Sun, Meh, Frown, CloudRain, Zap,
  MoreHorizontal, Phone, Info, Mic, Trash,
  MessageCircle, HelpCircle, ShieldAlert, Check
} from 'lucide-react';
import { Message, MessageRole, Mood, Session, UserSettings, SessionRating, Badge, BugReport, UserFeedback, Gender, Profession } from '../types';
import { ChatMessage } from '../components/ChatMessage';
import { EmergencyOverlay } from '../components/EmergencyOverlay';
import { SessionRatingModal } from '../components/SessionRatingModal';
import { FeedbackModal } from '../components/FeedbackModal';
import { checkForCrisis, classifyMessageRisk, generateTherapistResponse, generateSpeech, transcribeAudio } from '../services/openaiService';
import { trackUserActivity } from '../services/ragService';
import { saveRating, saveBugReport, saveUserFeedback, triggerRiskAlert, checkPendingInterventions, scanForPII, suspendUser, getClientConnection, getDirectMessages, sendDirectMessage, getSessionBookings, decideFollowupRequest, purchasePaidChat } from '../services/dataService';
import { chatPersistenceService } from '../services/chatPersistenceService';
import { MOODS } from '../constants';
import { isClientDemoAccount, readDemoChat, writeDemoChat, syncClientDemoUsage } from '../lib/clientDemo';
import { TherapistConnection } from '../types';
import { supabase } from '../services/supabaseClient';
import { redirectClientDemoToSignup } from '../lib/clientDemo';

interface ChatPageProps {
  settings: UserSettings;
  onUpdateUser: (u: UserSettings) => void;
  onSignUp: () => void;
  onTabChange?: (tab: string) => void;
}

const GUEST_LIMIT = 10;
const RISK_KEYWORDS_HIGH = ["kill myself", "suicide", "end it all", "want to die", "cutting myself", "hurt myself", "take my own life"];

let globalRenderCount = 0;

export const ChatPage: React.FC<ChatPageProps> = ({ settings, onUpdateUser, onSignUp, onTabChange }) => {
  const hasInitialized = useRef(false);
  globalRenderCount += 1;
  const currentRender = globalRenderCount;
  console.log(`[ChatPage RENDER] Render ${currentRender} | settings.id: ${settings?.id} | hasInitialized.current: ${hasInitialized.current}`);

  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionMood, setSessionMood] = useState<Mood | undefined>(undefined);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isCrisis, setIsCrisis] = useState(false);
  const [showEmergencyBanner, setShowEmergencyBanner] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | undefined>(undefined);
  const [newBadge, setNewBadge] = useState<Badge | null>(null);
  
  // Feedback Modal State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<'bug' | 'feedback'>('feedback');
  const [connection, setConnection] = useState<TherapistConnection | null>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'therapist'>('ai');
  const [directMessages, setDirectMessages] = useState<any[]>([]);
  const [isSendingDM, setIsSendingDM] = useState(false);
  const [hasVideoSession, setHasVideoSession] = useState<boolean>(false);
  
  // Safe Mode (Tarash Zone)
  const [safeMode, setSafeMode] = useState(false);

  // Follow-up and Paid Chat support states
  const [pendingFollowupReqs, setPendingFollowupReqs] = useState<any[]>([]);
  const [followupConversation, setFollowupConversation] = useState<any | null>(null);
  const [therapistPrices, setTherapistPrices] = useState<{ price1d: number; price7d: number; price1m: number } | null>(null);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);

  // Fetch if they have purchased an approved video session
  useEffect(() => {
    if (connection && settings.id) {
      const checkVideoAccess = async () => {
        try {
          const bookings = await getSessionBookings({ clientId: settings.id, therapistId: connection.therapistId });
          const hasApprovedVideo = bookings.some((b: any) => 
            b.sessionType === 'video' && 
            (b.status === 'Payment Approved' || b.status === 'Session Confirmed' || b.status === 'Therapist Assigned')
          );
          setHasVideoSession(hasApprovedVideo);
        } catch (err) {
          console.error("Error checking video session purchase:", err);
        }
      };
      checkVideoAccess();
      const intv = setInterval(checkVideoAccess, 5000);
      return () => clearInterval(intv);
    }
  }, [connection, settings.id]);

  const handleVideoCallClick = () => {
    if (!hasVideoSession) {
      alert("You have not purchased a video session yet or your payment is under review. Redirecting you to the Therapist Directory to purchase a video session slot.");
      if (onTabChange) {
        onTabChange('directory');
      }
    } else {
      if (connection?.meetingLink) {
        window.open(connection.meetingLink, '_blank');
      } else {
        alert("Your therapist has not generated the video link yet, but your video session is active and verified. Please ask them in chat to start the call.");
      }
    }
  };

  // Disqualification State
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [disqualificationReason, setDisqualificationReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guest Logic
  const isGuest = settings.is_anonymous;
  const isClientDemo = isClientDemoAccount(settings);
  const userMessageCount = messages.filter(m => m.role === MessageRole.USER).length;
  
  const [userAiCount, setUserAiCount] = useState<number>(0);
  const [limits, setLimits] = useState<any>(null);
  const previousLimits = useRef<any>(null);
  const [showPremiumActivated, setShowPremiumActivated] = useState(false);

  useEffect(() => {
    if (isClientDemo) {
      syncClientDemoUsage('status').then(usage => {
        if (usage && typeof usage.count === 'number') setUserAiCount(usage.count);
        if (usage && typeof usage.limit === 'number') setLimits({ name: 'Free', max_ai_chats: usage.limit });
      }).catch(() => {});
      return;
    }
    if (!isGuest && settings.id) {
       const fetchLimitsAndStats = async () => {
           try {
               const lRes = await fetch('/api/db/select', {
                  method: 'POST', headers:{'content-type':'application/json'},
                  body: JSON.stringify({table: 'user_subscriptions', filters: [{column: 'user_id', value: settings.id, type: 'eq'}]})
               });
               const lData = await lRes.json();
               let pRes = await fetch('/api/db/select', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({table: 'subscription_plans', filters: [{column: 'name', value: 'Free', type: 'eq'}]}) });
               let pData = await pRes.json();
               let userPlan = pData.data?.[0];
     
               if (lData.data && lData.data.length > 0) {
                   const sub = lData.data[0];
                   if (new Date(sub.expiry_date) > new Date() && sub.status === 'Active') {
                        let pReal = await fetch('/api/db/select', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({table: 'subscription_plans', filters: [{column: 'id', value: sub.plan_id, type: 'eq'}]}) });
                        let pRealData = await pReal.json();
                        if (pRealData.data && pRealData.data.length > 0) userPlan = pRealData.data[0];
                   }
               }
               setLimits(userPlan);
               if (userPlan && userPlan.name !== 'Free' && previousLimits.current && previousLimits.current.name === 'Free') {
                    setShowPremiumActivated(true);
               }
               previousLimits.current = userPlan;
           } catch(e) {}

           // count user ai messages today
           try {
               const today = new Date();
               today.setHours(0,0,0,0);
               const cRes = await fetch('/api/db/select', {
                   method: 'POST', headers:{'content-type':'application/json'},
                   body: JSON.stringify({
                       table: 'chat_messages',
                       filters: [
                           {column: 'user_id', value: settings.id, type: 'eq'},
                           {column: 'role', value: 'user', type: 'eq'}
                       ]
                   })
               });
               const cData = await cRes.json();
               if (cData.data) {
                   const todayMessages = cData.data.filter((m:any) => new Date(m.created_at) > today).length;
                   setUserAiCount(todayMessages);
               }
           } catch(e) {}
       };
       fetchLimitsAndStats();
       const interval = setInterval(fetchLimitsAndStats, 8000);
       return () => clearInterval(interval);
    }
  }, [settings.id, isGuest, isClientDemo]);

  const DAILY_AI_LIMIT = limits ? limits.max_ai_chats : 10;
  const isLimitReached = isGuest ? (userMessageCount >= GUEST_LIMIT) : (userAiCount >= DAILY_AI_LIMIT);

  // --- 1. INITIALIZATION & HISTORY RESTORE ---
  useEffect(() => {
    console.log(`[useEffect initSession] EFFECT TRIGGERED! dependencies: settings.id=${settings?.id}, settings.name=${settings?.name}, settings.isAdmin=${settings?.isAdmin}, settings.accountStatus=${settings?.accountStatus}`);
    
    const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
        let timeoutId: any;
        const timeoutPromise = new Promise<T>((resolve) => {
            timeoutId = setTimeout(() => {
                console.warn(`[Promise Timeout] Operation exceeded ${ms}ms limit. Falling back.`);
                resolve(fallback);
            }, ms);
        });
        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutId);
            return result;
        } catch (e) {
            clearTimeout(timeoutId);
            console.error(`[Promise Error] Caught error:`, e);
            return fallback;
        }
    };

    const initSession = async () => {
        console.log(`INIT_START - [initSession] EXECUTION STARTED. hasInitialized.current: ${hasInitialized.current}`);
        if (hasInitialized.current) {
            console.log(`[initSession] already initialized, returning early.`);
            return;
        }
        hasInitialized.current = true;
        setIsLoading(true);
        console.log(`[initSession] setIsLoading(true) called.`);
        
        try {
            // A. Check Disqualification
            if (settings.accountStatus === 'suspended') {
                setIsDisqualified(true);
                setDisqualificationReason(settings.suspensionReason || "Account Suspended");
                console.log("INIT_FAILED - Account is suspended");
                return;
            }

            // B. Recover or Create Session
            let activeSessionId = sessionId;
            
            if (isClientDemo) {
                const saved = readDemoChat();
                activeSessionId = crypto.randomUUID();
                setSessionId(activeSessionId);
                if (saved.length > 0) setMessages(saved);
            } else if (!settings.isAdmin && !isGuest) {
                const lastSession = await withTimeout(
                    chatPersistenceService.getLastActiveSession(settings.id),
                    2500,
                    null
                );
                
                console.log(`LAST_SESSION_RESULT:`, lastSession);
                
                if (lastSession) {
                    // Restore Found Session
                    activeSessionId = lastSession.id;
                    setSessionId(activeSessionId);
                    if (lastSession.moodStart) {
                        setSessionMood(lastSession.moodStart as Mood);
                    }
                    
                    // Fetch history and connection in parallel
                    const [history, conn] = await Promise.all([
                        withTimeout(chatPersistenceService.getChatHistory(activeSessionId), 2500, [] as Message[]),
                        withTimeout(getClientConnection(settings.id), 2500, null)
                    ]);
                    
                    console.log(`LOAD_HISTORY_RESULT:`, history.length, "messages loaded.");
                    setMessages(history);
                    setConnection(conn);
                } else {
                    // Create New Session and fetch connection in parallel
                    const tempSessionId = crypto.randomUUID();
                    const [newId, conn] = await Promise.all([
                        withTimeout(chatPersistenceService.createSession(settings.id, tempSessionId), 2500, tempSessionId),
                        withTimeout(getClientConnection(settings.id), 2500, null)
                    ]);
                    
                    console.log(`CREATE_SESSION_RESULT:`, newId);
                    activeSessionId = newId;
                    setSessionId(activeSessionId);
                    setConnection(conn);
                    console.log(`LOAD_HISTORY_RESULT: 0 messages loaded (new session).`);
                }
            } else {
                // Guest/Admin (Ephemeral Session)
                if(!activeSessionId) {
                    activeSessionId = crypto.randomUUID();
                    setSessionId(activeSessionId);
                }
                console.log(`LAST_SESSION_RESULT: Guest/Admin ephemeral session active.`, activeSessionId);
            }

            // C. Welcome Message (Only if chat is empty)
            setMessages(prev => {
                if (prev.length === 0) {
                    let welcomeText = "";
                    if (settings.isAdmin) {
                        welcomeText = "Admin System Online. Business Analytics Mode Active.";
                    } else {
                        welcomeText = `Hello, ${settings.name}. I'm Sukoon. I'm here to listen. How are you feeling right now?`;
                    }
                    const welcomeMsg: Message = { id: crypto.randomUUID(), role: MessageRole.MODEL, text: welcomeText, timestamp: Date.now() };
                    
                    // Persist welcome message if not admin/guest
                    if (!settings.isAdmin && !isGuest && !isClientDemo && activeSessionId) {
                        withTimeout(chatPersistenceService.saveMessage(settings.id, activeSessionId, welcomeMsg), 2000, undefined)
                            .catch(err => console.error("Error saving welcome message:", err));
                    }
                    return [welcomeMsg];
                }
                return prev;
            });
            
            console.log("INIT_COMPLETE");
        } catch (error) {
            console.error("INIT_FAILED - Session Init Error", error);
        } finally {
            setIsLoading(false);
            console.log(`[initSession] setIsLoading(false) executed.`);
        }
    };

    initSession();

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.log("Location denied")
        );
    }
  }, [settings.id, settings.name, settings.isAdmin, settings.accountStatus]);

  useEffect(() => {
    if (isClientDemo && messages.length > 0) writeDemoChat(messages);
  }, [isClientDemo, messages]);

  // Fetch Direct Messages when Therapist Tab is active
  useEffect(() => {
    if (activeTab === 'therapist' && connection) {
        const fetchDMs = async () => {
            const dms = await getDirectMessages(connection.therapistId);
            setDirectMessages(dms);
        };
        fetchDMs();
        const interval = setInterval(fetchDMs, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }
  }, [activeTab, connection]);

  // Fetch pending followups, active follow-up conversation, and therapist pricing configuration
  useEffect(() => {
    if (!settings.id) return;

    const fetchFollowupAndPrices = async () => {
      try {
        // 1. Fetch pending requests
        const { data: reqs } = await supabase.from('followup_requests')
          .select('*')
          .eq('patient_id', settings.id)
          .eq('status', 'PENDING');
        
        if (reqs && reqs.length > 0) {
          const resolved = await Promise.all(reqs.map(async (r: any) => {
            const { data: u } = await supabase.from('users').select('name').eq('id', r.therapist_id).single();
            return {
              ...r,
              therapistName: u?.name || 'Dr. Sarah'
            };
          }));
          setPendingFollowupReqs(resolved);
        } else {
          setPendingFollowupReqs([]);
        }

        // 2. Fetch active follow-up conversation
        const { data: activeConv } = await supabase.from('followup_conversations')
          .select('*')
          .eq('patient_id', settings.id)
          .eq('status', 'ACTIVE')
          .limit(1);
        
        if (activeConv && activeConv.length > 0) {
          setFollowupConversation(activeConv[0]);
        } else {
          setFollowupConversation(null);
        }

        // 3. Fetch current therapist pricing
        if (connection?.therapistId) {
          const { data: prof } = await supabase.from('therapist_profiles')
            .select('paid_chat_price_1d, paid_chat_price_7d, paid_chat_price_1m')
            .eq('id', connection.therapistId)
            .single();
          
          if (prof) {
            setTherapistPrices({
              price1d: prof.paid_chat_price_1d || 0,
              price7d: prof.paid_chat_price_7d || 0,
              price1m: prof.paid_chat_price_1m || 0
            });
          }
        }
      } catch (err) {
        console.error("Error loading followup data:", err);
      }
    };

    fetchFollowupAndPrices();
    const interval = setInterval(fetchFollowupAndPrices, 5000);
    return () => clearInterval(interval);
  }, [settings.id, connection]);

  // Poll for Interventions
  useEffect(() => {
      if (settings.isAdmin || isDisqualified) return;
      const interval = setInterval(() => {
          const interventions = checkPendingInterventions(settings.id);
          if (interventions.length > 0) {
              setMessages(prev => [...prev, ...interventions]);
          }
      }, 3000);
      return () => clearInterval(interval);
  }, [settings.id, settings.isAdmin, isDisqualified]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const toggleSafeMode = () => {
      const newState = !safeMode;
      setSafeMode(newState);
      if (newState) {
           setMessages(prev => [...prev, {
               id: crypto.randomUUID(), role: MessageRole.MODEL, timestamp: Date.now(),
               text: "This is the Tarash Zone. Nothing written here will be saved or used for analysis. You may express yourself freely."
           }]);
      }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsTyping(true);
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = (reader.result as string).split(',')[1];
              const text = await transcribeAudio(base64, file.type);
              setInputText(prev => (prev ? prev + ' ' : '') + text);
              setIsTyping(false);
          };
          reader.readAsDataURL(file);
      }
  }

  const handleMoodSelect = async (m: typeof MOODS[0]) => {
    setSessionMood(m.id as Mood);
    
    if (sessionId && !safeMode && !settings.isAdmin && !isGuest && !isClientDemo) {
      try {
        await chatPersistenceService.updateSessionMood(sessionId, m.id);
      } catch(e) {
        console.error("Failed to save mood", e);
      }
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: MessageRole.USER, text: `I am feeling ${m.label} today.`, timestamp: Date.now(), riskLevel: 'LOW' };
    
    let aiResponseText = "Thank you for checking in. How can I support you today?";
    if (m.id === 'happy') aiResponseText = "Glad you're feeling positive today. What's been going well for you?";
    else if (m.id === 'sad') aiResponseText = "I'm sorry you're having a difficult day. Would you like to talk about what's making you feel this way?";
    else if (m.id === 'anxious') aiResponseText = "It sounds like you may be feeling overwhelmed. What's causing the most concern right now?";
    else if (m.id === 'calm') aiResponseText = "It's wonderful that you're feeling calm. What's contributing to your peace of mind today?";
    else if (m.id === 'frustrated') aiResponseText = "I hear your frustration. Do you want to unpack what’s bothering you right now?";

    const botMsg: Message = { id: crypto.randomUUID(), role: MessageRole.MODEL, text: aiResponseText, timestamp: Date.now() };

    setMessages(prev => [...prev, userMsg, botMsg]);

    if (!safeMode && !settings.isAdmin && !isGuest && !isClientDemo && sessionId) {
      chatPersistenceService.saveMessage(settings.id, sessionId, userMsg);
      chatPersistenceService.saveMessage(settings.id, sessionId, botMsg);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    if (isLimitReached) return; 
    if (isDisqualified) return;

    // --- ZERO TOLERANCE PII CHECK ---
    const piiCheck = scanForPII(inputText);
    if (piiCheck.detected && !settings.isAdmin && !isClientDemo) {
        const reason = `Zero-Tolerance Violation: Attempted to share ${piiCheck.type} (${piiCheck.match})`;
        await suspendUser(settings.id, reason);
        triggerRiskAlert({ type: 'Policy Violation', message: `User attempted to share contact info: "${inputText}"`, userId: settings.id, userName: settings.name, triggerKeyword: piiCheck.match, id: '', clientId: settings.id, clientName: settings.name, detectedAt: Date.now(), status: 'Active' });
        setIsDisqualified(true);
        setDisqualificationReason("Attempting to share personal contact details (Phone/ID) outside the secure channel.");
        return; 
    }

    // --- SAFETY INTERVENTION CHECK ---
    const lowerInput = inputText.toLowerCase();
    const matchedKeyword = RISK_KEYWORDS_HIGH.find(k => lowerInput.includes(k));
    
    if (matchedKeyword && !isClientDemo) {
        triggerRiskAlert({ type: 'High Risk', message: `User triggered safety protocol. Input: "${inputText}"`, triggerKeyword: matchedKeyword, userId: settings.id, userName: settings.name, id: '', clientId: settings.id, clientName: settings.name, detectedAt: Date.now(), status: 'Active' });
        setInputText('');
        setIsCrisis(true); 
        return; 
    }

    // Update Activity Streak
    if (!safeMode && !isClientDemo) {
        const { updatedUser, newBadge: earnedBadge } = trackUserActivity(settings);
        const updatedTotal = updatedUser.stats?.totalActiveDays || 0;
        const currentTotal = settings.stats?.totalActiveDays || 0;
        if (updatedTotal !== currentTotal) {
            onUpdateUser(updatedUser);
        }
        if (earnedBadge) {
            setNewBadge(earnedBadge);
            setTimeout(() => setNewBadge(null), 5000);
        }
    }

    // 1. Optimistic UI Update (User Message)
    const riskLevel = classifyMessageRisk(inputText);
    const userMsg: Message = { id: crypto.randomUUID(), role: MessageRole.USER, text: inputText, timestamp: Date.now(), riskLevel };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    if (isClientDemo) {
      const usage = await syncClientDemoUsage('consume');
      setUserAiCount(usage.count || 0);
      if (!usage.allowed) return;
    } else if (!isGuest) setUserAiCount(prev => prev + 1);

    // Trigger Emergency Banner for HIGH & CRITICAL
    if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
        setShowEmergencyBanner(true);
    }

    // 2. Persist User Message (Async)
    if (!safeMode && !settings.isAdmin && !isGuest && !isClientDemo && sessionId) {
        chatPersistenceService.saveMessage(settings.id, sessionId, userMsg);
    }

    // Crisis Check on Input
    if (checkForCrisis(userMsg.text) || riskLevel === 'CRITICAL') {
      setIsCrisis(true);
      setIsTyping(false);
      return;
    }

    // 3. Generate AI Response (RAG happens inside `generateTherapistResponse` via `retrieveContext`)
    const history = messages.slice(-10).map(m => ({ role: m.role, text: m.text }));
    
    try {
        const response = await generateTherapistResponse(
            settings.id, history, userMsg.text,
            {
                name: settings.name, age: settings.age, gender: settings.gender as Gender, profession: settings.profession as Profession,
                language: settings.preferredLanguage, tone: settings.tonePreference, isAdmin: settings.isAdmin
            },
            location, settings.therapistStyle, settings.personalityMode,
            settings.memoryEnabled && !safeMode
        );
        
        if (checkForCrisis(response.text)) {
            setIsCrisis(true);
            setIsTyping(false);
            return;
        }

        // 4. Optimistic UI Update (AI Message) - Render text instantly to achieve sub-second visual completion
        const botMsg: Message = {
          id: crypto.randomUUID(), role: MessageRole.MODEL, text: response.text,
          timestamp: Date.now(), groundingLinks: response.groundingLinks
        };

        setMessages(prev => [...prev, botMsg]);

        // 5. Persist AI Message (Async)
        if (!safeMode && !settings.isAdmin && !isGuest && !isClientDemo && sessionId) {
            chatPersistenceService.saveMessage(settings.id, sessionId, botMsg);
        }

        // Generate and play voice in the background AFTER the text is rendered
        if ((settings.voiceEnabled || settings.autoPlayAudio) && !settings.isAdmin) {
            generateSpeech(response.text).then(audioData => {
                if (audioData) {
                    // Update state to associate the generated audio with the message
                    setMessages(prev => prev.map(m => m.id === botMsg.id ? { ...m, audioBase64: audioData } : m));
                    
                    // Asynchronously update the saved message in persistence to include the audio
                    if (!safeMode && !settings.isAdmin && !isGuest && !isClientDemo && sessionId) {
                        const updatedMsg = { ...botMsg, audioBase64: audioData };
                        chatPersistenceService.saveMessage(settings.id, sessionId, updatedMsg);
                    }

                    if (settings.autoPlayAudio) {
                        playAudio(audioData);
                    }
                }
            }).catch(speechError => {
                console.error("Asynchronous speech generation failed:", speechError);
            });
        }
    } catch (e) {
        console.error("AI response generation failed:", e);
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: MessageRole.MODEL,
          text: "I am having temporary connection trouble, but I am still here. Please share more about how you are feeling.",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsTyping(false);
    }
  };

  const handlePurchaseChat = async (duration: '1d' | '7d' | '1m', price: number) => {
    if (!connection || isPurchasing) return;
    const confirmBuy = window.confirm(`Confirm purchase of ${duration === '1d' ? '1 Day' : duration === '7d' ? '7 Days' : '1 Month'} chat support with ${connection.therapistName || 'Therapist'} for PKR ${price}?`);
    if (!confirmBuy) return;

    setIsPurchasing(true);
    try {
      await purchasePaidChat(connection.therapistId, duration);
      alert("Purchase successful! Your chat access window has been refreshed.");
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Error processing purchase.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleSendDirectMessage = async () => {
    if (!inputText.trim() || !connection) return;
    setIsSendingDM(true);
    try {
        await sendDirectMessage(connection.therapistId, inputText);
        const dms = await getDirectMessages(connection.therapistId);
        setDirectMessages(dms);
        setInputText('');
    } catch (e: any) {
        console.error("DM Error", e);
        alert(e.message || "Failed to send message. You might have reached your follow-up limit or need to configure a paid chat package.");
    } finally {
        setIsSendingDM(false);
    }
  };

  const playAudio = async (base64: string) => {
    try {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const ctx = audioContextRef.current;
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(0);
    } catch (e) { console.error("Audio error", e); }
  };

  const handleEndSession = () => setShowRating(true);
  const handleRatingSubmit = (rating: SessionRating) => { saveRating(rating); setShowRating(false); alert("Thank you for your feedback."); };

  const handleSubmitBug = async (report: Omit<BugReport, 'id' | 'timestamp' | 'status'>) => {
      await saveBugReport({ ...report, id: crypto.randomUUID(), timestamp: Date.now(), status: 'new' }, settings.is_anonymous);
      alert("Report submitted. Thank you for helping us improve.");
  }

  const handleSubmitFeedback = async (feedback: Omit<UserFeedback, 'id' | 'timestamp'>) => {
      await saveUserFeedback({ ...feedback, id: crypto.randomUUID(), timestamp: Date.now() }, settings.is_anonymous);
      alert("Feedback received. We appreciate your thoughts!");
  }

  // --- DISQUALIFIED VIEW ---
  if (isDisqualified) {
      return (
          <div className="fixed inset-0 z-[100] bg-rose-900 flex items-center justify-center p-6 text-center animate-fade-in">
              <div className="bg-white max-w-lg w-full p-10 rounded-3xl shadow-2xl">
                  <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  </div>
                  <h1 className="text-3xl font-bold text-rose-600 mb-4">Account Deactivated</h1>
                  <div className="bg-rose-50 border-l-4 border-rose-500 p-4 text-left mb-6">
                      <p className="font-bold text-rose-900 text-sm uppercase mb-1">Violation Detected:</p>
                      <p className="text-rose-800 text-sm leading-relaxed">
                          "You have been disqualified from the Sukoon Platform for violating our Zero-Tolerance Policy."
                      </p>
                  </div>
                  <p className="text-slate-600 mb-8 leading-relaxed">
                      <strong>Reason:</strong> {disqualificationReason}<br/><br/>
                      This action has been reported to the Administrator. If you believe this is a mistake, contact <span className="font-mono bg-slate-100 px-1 rounded">support@sukoon.com</span>.
                  </p>
                  <button onClick={onSignUp} className="w-full py-4 border-2 border-slate-200 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                      Return to Home
                  </button>
              </div>
          </div>
      );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-pulse font-sans h-full flex flex-col justify-end">
        {/* Fake message skeleton left */}
        <div className="flex gap-3 justify-start items-end max-w-[70%]">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-800 shrink-0" />
          <div className="h-10 bg-slate-100 dark:bg-navy-850 rounded-2xl rounded-bl-none w-48" />
        </div>
        {/* Fake message skeleton right */}
        <div className="flex gap-3 justify-end items-end max-w-[70%] ml-auto">
          <div className="h-12 bg-slate-150 dark:bg-navy-850 rounded-2xl rounded-br-none w-56" />
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-800 shrink-0" />
        </div>
        {/* Fake message skeleton left */}
        <div className="flex gap-3 justify-start items-end max-w-[70%]">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-800 shrink-0" />
          <div className="h-14 bg-slate-100 dark:bg-navy-850 rounded-2xl rounded-bl-none w-64" />
        </div>
        {/* Input box skeleton */}
        <div className="h-14 bg-slate-100 dark:bg-navy-800/80 rounded-3xl w-full mt-auto border border-slate-200/50 dark:border-navy-700/50" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative font-sans">
      {isCrisis && <EmergencyOverlay onClose={() => setIsCrisis(false)} />}
      
      {/* Emergency Banner */}
      {showEmergencyBanner && (
        <div id="emergency-banner" className="bg-rose-600 text-white px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg border-b border-rose-700 animate-fade-in z-20 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <div className="font-extrabold text-sm md:text-base uppercase tracking-wide">Emergency Support Available</div>
              <p className="text-[10px] md:text-xs text-rose-100 font-medium">If you are facing a severe mental health crisis, please reach out now.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => {
                setIsCrisis(true);
              }}
              className="px-4 py-2 bg-white text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-50 hover:scale-105 transition-all shadow-md"
            >
              Get Immediate Help
            </button>
            <button 
              onClick={() => {
                if (onTabChange) {
                    onTabChange('therapists');
                } else {
                    setActiveTab('therapist');
                }
              }}
              className="px-4 py-2 bg-rose-800 text-white border border-rose-500 rounded-xl text-xs font-bold hover:bg-rose-900 hover:scale-105 transition-all shadow-md"
            >
              Talk to a Therapist
            </button>
            <button 
              onClick={() => setShowEmergencyBanner(false)} 
              className="p-2 text-rose-100 hover:text-white transition-colors"
              title="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      
      {showRating && <SessionRatingModal sessionId={sessionId} onSubmit={handleRatingSubmit} onClose={() => setShowRating(false)} />}
      {showFeedbackModal && (
          <FeedbackModal 
            mode={feedbackMode}
            userId={settings.id}
            sessionId={sessionId}
            contextLogs={messages.slice(-5)}
            onClose={() => setShowFeedbackModal(false)}
            onSubmitBug={handleSubmitBug}
            onSubmitFeedback={handleSubmitFeedback}
          />
      )}
      
      {newBadge && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-in">
              <div className="bg-gradient-to-r from-amber-200 to-yellow-400 text-slate-900 px-6 py-3 rounded-full shadow-xl flex items-center gap-3 border border-yellow-300">
                  <span className="text-2xl">{newBadge.icon}</span>
                  <div><div className="font-bold text-sm">Badge Unlocked!</div><div className="text-xs font-medium">{newBadge.label}</div></div>
              </div>
          </div>
      )}

      {/* Guest Limit Overlay / Premium Limit Modal */}
      {isLimitReached && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in relative border border-slate-200 dark:border-navy-700">
                  <div className="text-center">
                      <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                         <Sparkles size={32} />
                      </div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{isGuest ? "Guest Preview Ended" : "You've Reached Today's Free Limit"}</h2>
                      <p className="text-slate-500 dark:text-slate-400 mb-6">
                          {isGuest ? "You've reached the message limit. Create a free account to continue." : "Upgrade to Premium and continue unlimited AI conversations, advanced wellness tools, and priority therapist matching."}
                      </p>
                      <div className="flex flex-col gap-3">
                          {isGuest ? (
                               <button onClick={onSignUp} className="w-full py-3 bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-600 transition-colors">Sign Up Now</button>
                          ) : (
                               <>
                                   <button onClick={() => { if (redirectClientDemoToSignup(settings)) return; if(onTabChange) onTabChange('plans') }} className="w-full py-3 bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-600 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5">Upgrade Now</button>
                                   <button onClick={() => { if (redirectClientDemoToSignup(settings)) return; if(onTabChange) onTabChange('plans') }} className="w-full py-3 bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors">Explore Plans</button>
                               </>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Success Modal */}
      {showPremiumActivated && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in relative border border-teal-200 dark:border-teal-900 overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-400 to-emerald-500" />
                  <div className="text-center mt-2 relative z-10">
                      <div className="bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce shrink-0 shadow-inner">
                         <span className="text-4xl block translate-y-px">🎉</span>
                      </div>
                      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Premium Activated</h2>
                      <p className="text-slate-500 dark:text-slate-400 mb-6">
                          Your subscription has been successfully activated.
                      </p>
                      <div className="bg-slate-50 dark:bg-navy-900/50 rounded-xl p-4 text-left border border-slate-100 dark:border-navy-700 mb-6 font-medium text-sm text-slate-700 dark:text-slate-300 space-y-3">
                          <div className="flex items-center gap-2"><Check size={18} className="text-teal-500" /> Unlimited AI Chats</div>
                          <div className="flex items-center gap-2"><Check size={18} className="text-teal-500" /> Unlimited Journal Entries</div>
                          <div className="flex items-center gap-2"><Check size={18} className="text-teal-500" /> Priority Therapist Matching</div>
                          <div className="flex items-center gap-2"><Check size={18} className="text-teal-500" /> Premium Wellness Tools</div>
                      </div>
                      <button onClick={() => setShowPremiumActivated(false)} className="w-full py-3.5 bg-teal-500 text-white rounded-xl font-bold text-lg hover:bg-teal-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0">
                          Start Chatting
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Main Chat Controls - Responsive */}
      {!settings.isAdmin && (
        <div className="sticky top-0 z-30 w-full bg-white/90 dark:bg-navy-950/90 backdrop-blur-md border-b border-slate-100 dark:border-navy-800 p-2 flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide pb-1">
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex rounded-xl bg-slate-100 dark:bg-navy-900 p-1 shadow-inner">
                        <button 
                            onClick={() => setActiveTab('ai')} 
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ai' ? 'bg-white dark:bg-navy-800 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} >
                            <Sparkles size={14} />
                            <span className="whitespace-nowrap">AI Assistant</span>
                        </button>
                        <button 
                            onClick={() => setActiveTab('therapist')} 
                            disabled={!connection}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'therapist' ? 'bg-white dark:bg-navy-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'}`} >
                            <Heart size={14} />
                            <span className="whitespace-nowrap">Therapist Chat</span>
                        </button>
                    </div>

                    {limits && limits.name !== 'Free' && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/40 border border-amber-200 dark:border-amber-700/50 rounded-lg shrink-0 animate-fade-in shadow-sm">
                            <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider hidden sm:inline-block">Premium</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0 pr-2">
                    <button onClick={toggleSafeMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm ${safeMode ? 'bg-slate-800 text-white' : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-navy-700 hover:bg-slate-50'}`}>
                        <ShieldAlert size={14} />
                        <span className="whitespace-nowrap">{safeMode ? "Exit Tarash" : "Tarash Zone"}</span>
                    </button>
                    <button onClick={() => setIsCrisis(true)} className="flex items-center gap-2 px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors shadow-md animate-pulse">
                        <AlertTriangle size={14} />
                        <span className="whitespace-nowrap">EMERGENCY</span>
                    </button>
                    <button onClick={handleEndSession} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-navy-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
                        <Trash size={14} />
                        <span className="whitespace-nowrap">End</span>
                    </button>
                </div>
            </div>

            {/* Therapist Connection Widget - Compact on Mobile */}
            {connection && activeTab === 'ai' && (
                <div className="bg-teal-50 dark:bg-teal-900/20 px-3 py-2 rounded-xl border border-teal-100 dark:border-teal-800/50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                            {connection.therapistName?.charAt(0) || 'T'}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Assigned Therapist</div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{connection.therapistName}</div>
                        </div>
                    </div>
                    {connection.meetingLink && (
                        <button 
                            onClick={handleVideoCallClick}
                            className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-1 shrink-0"
                        >
                            📹 Join
                        </button>
                    )}
                </div>
            )}

            {connection && activeTab === 'therapist' && (
                <div className="bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800/50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                            {connection.therapistName?.charAt(0) || 'T'}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Assigned Therapist</div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{connection.therapistName}</div>
                        </div>
                    </div>
                    <button 
                        onClick={handleVideoCallClick}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center gap-1 shrink-0"
                    >
                        📹 Join Video Session
                    </button>
                </div>
            )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 lg:px-20 py-6 scrollbar-hide">
        {activeTab === 'ai' ? (
            <>
                {messages.length < 3 && !settings.isAdmin && (
                    <div className="mb-8 flex flex-col items-center animate-fade-in w-full max-w-2xl mx-auto">
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">How are you feeling right now?</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                            {MOODS.map(m => (
                                <button 
                                    key={m.id} 
                                    onClick={() => handleMoodSelect(m)} 
                                    className={`flex flex-col items-center gap-3 p-6 rounded-3xl shadow-sm hover:shadow-md transition-all border group ${sessionMood === m.id ? 'bg-teal-50 border-teal-200 dark:bg-teal-900/40 dark:border-teal-700 scale-105' : 'bg-white hover:scale-105 dark:bg-navy-800 border-slate-50 dark:border-navy-700'}`} >
                                    <span className={`text-4xl transition-transform ${sessionMood === m.id ? 'scale-110' : 'group-hover:scale-110'}`}>{m.emoji}</span>
                                    <span className={`text-xs uppercase font-bold tracking-wider ${sessionMood === m.id ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`}>{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map(msg => <ChatMessage key={msg.id} message={msg} onPlayAudio={playAudio} />)}
                {isTyping && <div className="flex items-center gap-2 text-lavender-400 dark:text-teal-400/60 text-xs ml-4 mb-6"><span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span><span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span><span className="ml-1 opacity-70 italic">Sukoon is thinking...</span></div>}
            </>
        ) : (
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Pending Reconnect Invitations */}
                {pendingFollowupReqs.map(req => (
                    <div key={req.id} className="bg-amber-50 border border-amber-200 p-6 rounded-3xl mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
                        <div className="flex items-center gap-4">
                            <span className="text-3xl">🤝</span>
                            <div>
                                <h4 className="font-bold text-slate-800">{req.therapistName} wants to reconnect with you</h4>
                                <p className="text-xs text-slate-500 leading-relaxed">Accepting this request will open a temporary follow-up channel with up to 10 free replies.</p>
                            </div>
                        </div>
                        <div className="flex gap-2 self-stretch sm:self-auto shrink-0">
                            <button
                                onClick={async () => {
                                    try {
                                        await decideFollowupRequest(req.id, 'accept');
                                        alert("You accepted the follow-up request! Welcome back to connection.");
                                        window.location.reload();
                                    } catch (err: any) {
                                        alert(err.message || 'Error accepting request.');
                                    }
                                }}
                                className="flex-1 sm:flex-none px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
                            >
                                Accept
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await decideFollowupRequest(req.id, 'decline');
                                        alert("Declined the follow-up invitation.");
                                        window.location.reload();
                                    } catch (err: any) {
                                        alert(err.message || 'Error declining request.');
                                    }
                                }}
                                className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                ))}

                {/* Remaining Replies Counter */}
                {followupConversation && (
                    <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl text-xs text-teal-900 flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span>💬</span>
                            <span className="font-bold">Follow-Up Thread:</span>
                            <span>{10 - followupConversation.patient_message_count} of 10 follow-up replies remaining.</span>
                        </div>
                        <span className="font-semibold bg-white/60 text-teal-700 px-2 py-0.5 rounded-full">{followupConversation.patient_message_count} / 10 used</span>
                    </div>
                )}

                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl mb-8 flex items-center justify-between gap-6 flex-wrap">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                            {connection?.therapistName?.charAt(0) || 'T'}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Session with {connection?.therapistName || 'your Therapist'}</h2>
                            <p className="text-sm text-slate-500">This is a private, secure channel between you and your therapist.</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleVideoCallClick} 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shrink-0 duration-300"
                    >
                        📹 Join Video Session
                    </button>
                </div>

                {/* Locked limit feedback with pricing support */}
                {followupConversation && followupConversation.patient_message_count >= 10 && (
                    <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl mb-6 text-center shadow-sm">
                        <span className="text-3xl mb-2 block animate-pulse">⏰</span>
                        <h4 className="font-bold text-rose-950 mb-1">Follow-Up Limit Reached</h4>
                        <p className="text-xs text-rose-800 mb-4 max-w-xl mx-auto leading-relaxed">
                            Follow-up limit reached. Purchase chat support or standard therapy session to continue.
                        </p>
                        
                        {therapistPrices && (therapistPrices.price1d > 0 || therapistPrices.price7d > 0 || therapistPrices.price1m > 0) ? (
                            <div className="max-w-md mx-auto bg-white p-4 rounded-2xl border border-rose-100">
                                <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-widest mb-3">Unlock Daily/Weekly Support Plans</h5>
                                <div className="grid grid-cols-3 gap-2">
                                    {therapistPrices.price1d > 0 && (
                                        <button
                                            onClick={() => handlePurchaseChat('1d', therapistPrices.price1d)}
                                            disabled={isPurchasing}
                                            className="bg-slate-50 border border-slate-100 hover:border-teal-200 hover:bg-teal-50/20 p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
                                        >
                                            <span className="font-bold text-slate-700 text-[11px]">1 Day</span>
                                            <span className="text-xs mt-1 text-teal-700 font-extrabold">Rs {therapistPrices.price1d}</span>
                                        </button>
                                    )}
                                    {therapistPrices.price7d > 0 && (
                                        <button
                                            onClick={() => handlePurchaseChat('7d', therapistPrices.price7d)}
                                            disabled={isPurchasing}
                                            className="bg-slate-50 border border-slate-100 hover:border-teal-200 hover:bg-teal-50/20 p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
                                        >
                                            <span className="font-bold text-slate-700 text-[11px]">7 Days</span>
                                            <span className="text-xs mt-1 text-teal-700 font-extrabold">Rs {therapistPrices.price7d}</span>
                                        </button>
                                    )}
                                    {therapistPrices.price1m > 0 && (
                                        <button
                                            onClick={() => handlePurchaseChat('1m', therapistPrices.price1m)}
                                            disabled={isPurchasing}
                                            className="bg-slate-50 border border-slate-100 hover:border-teal-200 hover:bg-teal-50/20 p-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
                                        >
                                            <span className="font-bold text-slate-700 text-[11px]">1 Month</span>
                                            <span className="text-xs mt-1 text-teal-700 font-extrabold">Rs {therapistPrices.price1m}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-400 italic">No chat plans configured yet. Please purchase a regular session instead.</p>
                        )}
                    </div>
                )}

                {directMessages.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-4xl mb-4">💬</div>
                        <p className="text-slate-400 italic">No messages yet. Start the conversation with your therapist.</p>
                    </div>
                ) : (
                    directMessages.map((dm: any) => (
                        <div key={dm.id} className={`flex ${dm.sender_id === settings.id ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${dm.sender_id === settings.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                                <p className="text-sm leading-relaxed">{dm.content}</p>
                                <div className={`text-[10px] mt-2 opacity-60 ${dm.sender_id === settings.id ? 'text-white' : 'text-slate-500'}`}>
                                    {new Date(dm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 lg:p-6 bg-white dark:bg-navy-900 border-t border-lavender-100 dark:border-navy-800 transition-colors shrink-0">
        <div className="max-w-4xl mx-auto flex items-end gap-3 relative">
          <div className="flex-1 bg-slate-50 dark:bg-navy-950 rounded-3xl px-4 lg:px-6 py-3 lg:py-4 shadow-inner focus-within:ring-2 focus-within:ring-teal-400/50 dark:focus-within:ring-teal-500/30 transition-all flex items-center gap-2 border border-transparent dark:border-navy-800">
            {/* Progress Bar for Guest */}
            {isGuest && (
                <div className="absolute bottom-full left-0 w-full px-6 pb-2">
                    <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase mb-1">
                        <span>Guest Preview</span>
                        <span>{userMessageCount}/{GUEST_LIMIT} msgs</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-navy-800 rounded-full h-1">
                        <div className={`h-full rounded-full transition-all ${isLimitReached ? 'bg-rose-500' : 'bg-teal-500'}`} style={{ width: `${(userMessageCount / GUEST_LIMIT) * 100}%` }}></div>
                    </div>
                </div>
            )}
            
            <input type="file" accept="audio/*" className="hidden" ref={fileInputRef} onChange={handleAudioUpload}/>
            <button onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors p-1" title="Upload Audio">
                <Mic size={20} />
            </button>
            <textarea 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                onKeyDown={(e) => { 
                    if (e.key === 'Enter' && !e.shiftKey) { 
                        e.preventDefault(); 
                        activeTab === 'ai' ? handleSendMessage() : handleSendDirectMessage(); 
                    } 
                }} 
                placeholder={isLimitReached ? "Preview limit reached." : (activeTab === 'therapist' && followupConversation && followupConversation.patient_message_count >= 10) ? "Follow-up limit reached. Book another session to continue." : (activeTab === 'therapist' && connection?.chatExpiresAt && new Date(connection.chatExpiresAt) < new Date()) ? "Chat expired. Book a new session to continue." : "Type thoughtfully..."} 
                className="w-full bg-transparent border-none outline-none resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 h-6 max-h-32 font-sans text-sm lg:text-base" 
                rows={1} 
                disabled={isLimitReached || (activeTab === 'therapist' && followupConversation && followupConversation.patient_message_count >= 10) || (activeTab === 'therapist' && !!(connection?.chatExpiresAt && new Date(connection.chatExpiresAt) < new Date()))}
                dir="auto"
            />
          </div>
          <button 
            onClick={activeTab === 'ai' ? handleSendMessage : handleSendDirectMessage} 
            disabled={!inputText.trim() || isTyping || isLimitReached || isSendingDM || (activeTab === 'therapist' && followupConversation && followupConversation.patient_message_count >= 10) || (activeTab === 'therapist' && !!(connection?.chatExpiresAt && new Date(connection.chatExpiresAt) < new Date()))} 
            className={`p-3 lg:p-4 rounded-full transition-all shadow-lg ${(!inputText.trim() || isLimitReached || isSendingDM || (activeTab === 'therapist' && followupConversation && followupConversation.patient_message_count >= 10) || (activeTab === 'therapist' && !!(connection?.chatExpiresAt && new Date(connection.chatExpiresAt) < new Date()))) ? 'bg-slate-200 dark:bg-navy-800 text-slate-400 dark:text-slate-600' : activeTab === 'ai' ? 'bg-teal-600 dark:bg-teal-700 text-white hover:bg-teal-700 dark:hover:bg-teal-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'} hover:scale-105 active:scale-95 shrink-0`} >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
