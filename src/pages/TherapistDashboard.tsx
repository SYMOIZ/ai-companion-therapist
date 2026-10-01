
import React, { useState, useEffect } from 'react';
import { 
    getTherapyNotes, 
    saveTherapyNote, 
    getTherapistPatients, 
    updateTherapistProfile, 
    saveSupportTicket, 
    getTransactions, 
    requestPayout, 
    getReviews, 
    getTherapistSchedule,
    getSessionBookings, 
    addCalendarSlot, 
    deleteCalendarSlot, 
    updateMeetingLink, 
    createNotification, 
    getDirectMessages, 
    sendDirectMessage,
    createTherapistBoost,
    getTherapistBoosts,
    createTherapistSubscription,
    getTherapistSubscriptions,
    getTherapistPreviousPatients,
    sendFollowupRequest,
    configurePaidChat,
    getTherapistAssignedAlerts,
    respondToRiskAssignment
} from '../services/dataService';
import { TherapyNote, AdminUserView, Therapist, SupportTicket, Transaction, Review, CalendarSlot, TherapistConnection, RiskAlert } from '../types';
import { CodeOfConductPage, ClinicalGuidelinesPage, CrisisProtocolPage, PayoutPolicyPage, NonCircumventionPage, ReportIncidentPage } from './TherapistResources';
import { Sparkles, Award, TrendingUp, ShieldCheck, Upload, Check, Info, Clock } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface TherapistDashboardProps {
    view: 'overview' | 'schedule' | 'calendar' | 'patients' | 'finance' | 'analytics' | 'profile' | 'support' | 'code-of-conduct' | 'guidelines' | 'crisis-protocol' | 'payout-policy' | 'non-circumvention' | 'report-incident' | 'chat';
    userId: string;
    initialTab?: any; // Deprecated, kept for compat
}

export const TherapistDashboard: React.FC<TherapistDashboardProps> = ({ view = 'overview', userId }) => {
    // Current Therapist ID
    const CURRENT_THERAPIST_ID = userId; 

    const [isLoading, setIsLoading] = useState(true);
    const [patients, setPatients] = useState<TherapistConnection[]>([]);
    const [notes, setNotes] = useState<TherapyNote[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [activeChatPatientId, setActiveChatPatientId] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isSendingChat, setIsSendingChat] = useState(false);
    const [isEditingMeetingLink, setIsEditingMeetingLink] = useState(false);
    const [tempMeetingLink, setTempMeetingLink] = useState('');
    const [noteDraft, setNoteDraft] = useState({ title: '', details: '', mark: 'Progress' });
    
    // Profile State (Expanded)
    const [profile, setProfile] = useState<Partial<Therapist>>({ 
        bio: '', 
        bookingUrl: '', 
        specialty: '', 
        experience: 0,
        licenseNumber: '',
        bankDetails: { bankName: '', accountTitle: '', iban: '' },
        notificationPrefs: { email: true, sms: true },
        clinicalSpecializations: [],
        loyaltyPoints: 1250,
        badges: []
    });

    // Finance State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [availableBalance, setAvailableBalance] = useState(0);
    const [pendingBalance, setPendingBalance] = useState(0);
    const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');

    // Analytics State
    const [reviews, setReviews] = useState<Review[]>([]);

    // Promotions and Upgrades State
    const [therapistBoosts, setTherapistBoosts] = useState<any[]>([]);
    const [therapistSubs, setTherapistSubs] = useState<any[]>([]);
    
    // Promotions Checkout Modals State
    const [selectedBoostPack, setSelectedBoostPack] = useState<'basic' | 'professional' | null>(null);
    const [showProUpgradeModal, setShowProUpgradeModal] = useState(false);
    const [acceptedPromoTerms, setAcceptedPromoTerms] = useState(false);
    const [promoProof, setPromoProof] = useState<string | null>(null);
    const [submittingPromo, setSubmittingPromo] = useState(false);

    const [profileTab, setProfileTab] = useState<'general' | 'practice' | 'banking'>('general');
    const [isProfileComplete, setIsProfileComplete] = useState(false);

    // Support State
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [ticketData, setTicketData] = useState({ type: 'General Inquiry', priority: 'Medium', subject: '', description: '', imageUrl: '' });

    // Calendar State
    const [schedule, setSchedule] = useState<CalendarSlot[]>([]);
    const [sessionBookings, setSessionBookings] = useState<any[]>([]);
    const [weekOffset, setWeekOffset] = useState(0);
    const [showAddSlotModal, setShowAddSlotModal] = useState(false);
    const [newSlotDate, setNewSlotDate] = useState(''); // ISO Date string for the day being added to
    const [newSlotData, setNewSlotData] = useState({ time: '09:00 AM', duration: 45 });

        // AI Chat State
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');

    // Follow-up and Paid Chat States
    const [previousPatients, setPreviousPatients] = useState<TherapistConnection[]>([]);
    const [sendingFollowupIds, setSendingFollowupIds] = useState<string[]>([]);
    const [followupStatusMessage, setFollowupStatusMessage] = useState<string>('');
    const [paidChatPrices, setPaidChatPrices] = useState({ price1d: 0, price7d: 0, price1m: 0 });
    const [isPriceUpdating, setIsPriceUpdating] = useState(false);
    const [priceError, setPriceError] = useState('');
    const [assignedAlerts, setAssignedAlerts] = useState<RiskAlert[]>([]);

    // Derived State
    const selectedPatient = patients.find(p => p.clientId === selectedPatientId) || previousPatients.find(p => p.clientId === selectedPatientId);
    const filteredNotes = notes.filter(n => n.userId === selectedPatientId).sort((a,b) => b.createdAt - a.createdAt);

    const refreshAssignedAlerts = async () => {
        const assigned = await getTherapistAssignedAlerts(CURRENT_THERAPIST_ID);
        setAssignedAlerts(assigned);
    };

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Parallel fetching for better performance
                const [patientsData, previousPatientsData, notesData, txsData, reviewsData, scheduleData, bookingData, boostsData, subsData, assignedAlertsData] = await Promise.all([
                    getTherapistPatients(CURRENT_THERAPIST_ID),
                    getTherapistPreviousPatients(CURRENT_THERAPIST_ID),
                    getTherapyNotes(),
                    getTransactions(),
                    getReviews(CURRENT_THERAPIST_ID),
                    getTherapistSchedule(CURRENT_THERAPIST_ID),
                    getSessionBookings({ therapistId: CURRENT_THERAPIST_ID }),
                    getTherapistBoosts(CURRENT_THERAPIST_ID),
                    getTherapistSubscriptions(CURRENT_THERAPIST_ID),
                    getTherapistAssignedAlerts(CURRENT_THERAPIST_ID)
                ]);

                setPatients(patientsData);
                setPreviousPatients(previousPatientsData);
                setNotes(notesData);
                setTransactions(txsData);
                calculateBalances(txsData);
                setReviews(reviewsData);
                setSchedule(scheduleData);
                setSessionBookings(bookingData || []);
                setTherapistBoosts(boostsData || []);
                setTherapistSubs(subsData || []);
                setAssignedAlerts(assignedAlertsData);

                const { data: profileList } = await supabase.from('therapist_profiles').select('*').eq('user_id', CURRENT_THERAPIST_ID);
                if (profileList && profileList.length > 0) {
                    const prof = profileList[0];
                    setPaidChatPrices({
                        price1d: prof.pricing_45 || 0,
                        price7d: prof.pricing_60 || 0,
                        price1m: prof.pricing_90 || 0
                    });
                    setProfile(prev => ({
                        ...prev,
                        bio: prof.bio || '',
                        specialty: prof.specialty || '',
                        experience: prof.experience || 0,
                        bookingUrl: prof.booking_url || '',
                        licenseNumber: prof.license_number || '',
                        bankDetails: prof.bank_details || { bankName: '', accountTitle: '', iban: '' },
                        notificationPrefs: prof.notification_prefs || { email: true, sms: true },
                        clinicalSpecializations: prof.clinical_specializations || [],
                        loyaltyPoints: prof.loyalty_points || 1250
                    }));
                }

                // Mock loading profile data
                setProfile(prev => ({
                    ...prev,
                    badges: [
                        { id: '1', label: '5-Star Healer', icon: '🌟', description: 'Maintain 5.0 Rating', isUnlocked: true },
                        { id: '2', label: 'Century Club', icon: '💯', description: 'Complete 100 sessions', isUnlocked: false },
                        { id: '3', label: 'Early Bird', icon: '🌅', description: '20 Morning Sessions', isUnlocked: true },
                        { id: '4', label: 'Guardian', icon: '🛡️', description: 'Reported high-risk alert', isUnlocked: true },
                        { id: '5', label: 'Super Streak', icon: '⚡', description: '30 Days Active', isUnlocked: false },
                    ]
                }));
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Chat Polling
    useEffect(() => {
        if (activeChatPatientId) {
            const fetchChat = async () => {
                const msgs = await getDirectMessages(activeChatPatientId);
                setChatMessages(msgs);
            };
            fetchChat();
            const interval = setInterval(fetchChat, 5000);
            return () => clearInterval(interval);
        }
    }, [activeChatPatientId]);

    const handleSendChat = async () => {
        if (!chatInput.trim() || !activeChatPatientId) return;
        setIsSendingChat(true);
        try {
            await sendDirectMessage(activeChatPatientId, chatInput);
            const msgs = await getDirectMessages(activeChatPatientId);
            setChatMessages(msgs);
            setChatInput('');
        } catch (e) {
            console.error("Chat Error", e);
        } finally {
            setIsSendingChat(false);
        }
    };

    const refreshSchedule = () => {
        getTherapistSchedule(CURRENT_THERAPIST_ID).then(setSchedule);
    };

    const reloadPromos = async () => {
        const [b, s] = await Promise.all([
            getTherapistBoosts(CURRENT_THERAPIST_ID),
            getTherapistSubscriptions(CURRENT_THERAPIST_ID)
        ]);
        setTherapistBoosts(b || []);
        setTherapistSubs(s || []);
    };

    const handlePromoScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPromoProof(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePurchaseBoost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBoostPack) return;
        if (!acceptedPromoTerms) {
            alert("You must agree to the marketing visibility terms & conditions.");
            return;
        }
        if (!promoProof) {
            alert("Please upload payment receipt screenshot.");
            return;
        }

        setSubmittingPromo(true);
        try {
            const cost = selectedBoostPack === 'basic' ? 3000 : 10000;
            const duration = selectedBoostPack === 'basic' ? 7 : 30;
            
            await createTherapistBoost({
                id: crypto.randomUUID(),
                therapist_id: CURRENT_THERAPIST_ID,
                package_type: selectedBoostPack === 'basic' ? 'Basic Boost' : 'Professional Boost',
                duration_days: duration,
                cost: cost,
                payment_screenshot: promoProof,
                status: 'Pending'
            });

            // Notify Admin
            await createNotification(
                '00000000-0000-0000-0000-000000000000',
                'New Promotional Visibility Boost Request',
                `Dr. ${profile.name || 'Practitioner'} uploaded PKR ${cost} deposit for a ${selectedBoostPack === 'basic' ? '7-day' : '30-day'} directory visibility boost.`,
                'system'
            );

            alert("Boost request submitted successfully! An administrator is auditing your payment proof.");
            setSelectedBoostPack(null);
            setAcceptedPromoTerms(false);
            setPromoProof(null);
            reloadPromos();
        } catch (err) {
            console.error(err);
            alert("Error submitting boost request.");
        } finally {
            setSubmittingPromo(false);
        }
    };

    const handlePurchaseProSub = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!acceptedPromoTerms) {
            alert("You must accept the premium practitioner compliance terms.");
            return;
        }
        if (!promoProof) {
            alert("Please upload payment receipt screenshot.");
            return;
        }

        setSubmittingPromo(true);
        try {
            const cost = 5000; // PKR 5000 / month
            
            await createTherapistSubscription({
                id: crypto.randomUUID(),
                therapist_id: CURRENT_THERAPIST_ID,
                plan_type: 'Pro Plan',
                cost: cost,
                payment_screenshot: promoProof,
                status: 'Pending'
            });

            // Notify Admin
            await createNotification(
                '00000000-0000-0000-0000-000000000000',
                'New Therapist Pro Upgrade Upgrade Request',
                `Dr. ${profile.name || 'Practitioner'} uploaded PKR 5,000 payment proof for a Pro dashboard tier subscription.`,
                'system'
            );

            alert("PRO subscription upgrade request placed! An admin is audit-checking your receipt.");
            setShowProUpgradeModal(false);
            setAcceptedPromoTerms(false);
            setPromoProof(null);
            reloadPromos();
        } catch (err) {
            console.error(err);
            alert("Error submitting Pro Upgrade.");
        } finally {
            setSubmittingPromo(false);
        }
    };

    // Check Completion Logic
    useEffect(() => {
        const hasBio = !!profile.bio;
        const hasLink = !!profile.bookingUrl && profile.bookingUrl.startsWith('http');
        const hasBank = !!profile.bankDetails?.accountTitle && !!profile.bankDetails?.iban;
        const hasSpecs = (profile.clinicalSpecializations?.length || 0) > 0;
        
        const complete = hasBio && hasLink && hasBank && hasSpecs;
        setIsProfileComplete(complete);
    }, [profile]);

    const calculateBalances = (txs: Transaction[]) => {
        let available = 0;
        let pending = 0;
        let lifetime = 0;
        const now = Date.now();
        const TWENTY_NINE_DAYS_MS = 29 * 24 * 60 * 60 * 1000;

        txs.forEach(t => {
            // Credits (Sessions)
            if (!t.type || t.type === 'Credit') {
                const txDate = new Date(t.date).getTime();
                const isCleared = (now - txDate) > TWENTY_NINE_DAYS_MS;
                const netAmount = t.therapistPayout; // Net after 20%

                if (t.status === 'Verified') {
                    lifetime += netAmount;
                    if (isCleared) available += netAmount;
                    else pending += netAmount;
                }
            } 
            // Debits (Withdrawals)
            else if (t.type === 'Debit') {
                if (t.status !== 'Rejected') {
                    available -= t.amount;
                }
            }
        });

        setAvailableBalance(Math.max(0, available));
        setPendingBalance(pending);
        setLifetimeEarnings(lifetime);
    };

    const handleWithdraw = async () => {
        const amt = Number(withdrawAmount);
        if (amt <= 0) { alert("Invalid amount."); return; }
        if (amt > availableBalance) { alert("Insufficient available balance."); return; }
        if (!profile.bankDetails?.accountTitle) { alert("Please setup banking details first."); return; }

        await requestPayout(amt, profile.bankDetails);
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        alert("Withdrawal Request Submitted. Processing takes 24-48 hours.");
        
        const updatedTxs = await getTransactions();
        setTransactions(updatedTxs);
        calculateBalances(updatedTxs);
    };

    const handleSaveNote = async () => {
        if (!selectedPatientId || !noteDraft.title) return;
        const newNote: TherapyNote = {
            id: crypto.randomUUID(),
            userId: selectedPatientId,
            therapistId: CURRENT_THERAPIST_ID,
            title: noteDraft.title,
            details: noteDraft.details,
            markType: noteDraft.mark as any,
            dateOfNote: new Date().toISOString().split('T')[0],
            createdAt: Date.now(),
            nextReminder: 'No Reminder'
        };
        await saveTherapyNote(newNote);
        setNotes([...notes, newNote]);
        setNoteDraft({ title: '', details: '', mark: 'Progress' });
    };

    const handlePoliteDecline = () => {
        const reason = prompt("Private Reason for decline (Health, Emergency, Burnout):");
        if (reason) {
            alert("System Message Sent to Client:\n\n'Dr. [Name] sends their deepest apologies but must reschedule due to a personal emergency. They have prioritized your next slot.'");
        }
    };

    const handleSaveProfile = async () => {
        let payload = { ...profile };
        if (profile.bankDetails?.iban && profile.bankDetails?.bankName) {
            payload.bankDetailsLocked = true;
        }
        await updateTherapistProfile(CURRENT_THERAPIST_ID, payload);
        setProfile(payload);
        alert("Profile Updated Successfully.");
    }

    const handleSaveMeetingLink = async () => {
        if (!selectedPatient) return;
        const success = await updateMeetingLink(selectedPatient.id, tempMeetingLink);
        if (success) {
            setIsEditingMeetingLink(false);
            // Refresh patients
            getTherapistPatients(CURRENT_THERAPIST_ID).then(setPatients);
            // Notify client
            await createNotification(
                selectedPatient.clientId,
                "Meeting Link Updated",
                `Your therapist has updated the meeting link for your sessions.`,
                'meeting'
            );
            alert("Meeting link updated and client notified.");
        }
    };

    const handleSubmitTicket = async () => {
        if (!ticketData.subject || !ticketData.description) return;
        const ticket: SupportTicket = {
            id: crypto.randomUUID(),
            userId: CURRENT_THERAPIST_ID,
            type: ticketData.type as any,
            priority: ticketData.priority as any,
            subject: ticketData.subject,
            description: ticketData.description,
            imageUrl: ticketData.imageUrl,
            status: 'Open',
            timestamp: Date.now(),
            created_at: new Date().toISOString()
        };
        await saveSupportTicket(ticket);
        setShowSupportModal(false);
        setTicketData({ type: 'General Inquiry', priority: 'Medium', subject: '', description: '', imageUrl: '' });
        alert("Ticket Submitted. Reference: #" + ticket.id.substring(0,6));
    }

    const askClinicalAI = () => {
        if (!aiQuery) return;
        setTimeout(() => {
            setAiResponse("Based on the symptoms described (insomnia, racing thoughts before exams), this suggests Performance Anxiety. Consider recommending Progressive Muscle Relaxation (PMR) before bed and Cognitive Reframing for the 'catastrophic' exam thoughts.");
        }, 1000);
    };

    const getWeekDays = (offset: number) => {
        const today = new Date();
        today.setDate(today.getDate() + (offset * 7));
        const day = today.getDay(); 
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        
        const days = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const handleAddSlot = async () => {
        await addCalendarSlot({
            date: newSlotDate,
            time: newSlotData.time,
            duration: newSlotData.duration,
            status: 'available'
        });
        setShowAddSlotModal(false);
        refreshSchedule();
    };

    const handleDeleteSlot = async (id: string) => {
        if (confirm("Remove this availability slot?")) {
            await deleteCalendarSlot(id);
            refreshSchedule();
        }
    };

    // --- OVERVIEW / HOME COMPONENT ---
    const OverviewView = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const todaysAppointments = schedule.filter(s => s.date === todayStr && (s.status === 'booked' || s.status === 'pending'));
        const nextSession = todaysAppointments.find(s => s.status === 'booked');

        return (
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                {/* 1. Alerts */}
                {!isProfileComplete && (
                    <div className="bg-amber-100 border border-amber-200 rounded-2xl p-6 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-4">
                            <span className="text-3xl">⚠️</span>
                            <div>
                                <h3 className="text-amber-900 font-bold text-lg">Your Profile is Incomplete</h3>
                                <p className="text-amber-800 text-sm">You are currently hidden from the client directory. Complete your setup to accept bookings.</p>
                            </div>
                        </div>
                        <button className="bg-amber-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-800 shadow-lg">Complete Setup</button>
                    </div>
                )}

                {/* 1.5. Urgent Assigned Cases */}
                {assignedAlerts.some(a => a.assignmentStatus === 'pending') && (
                    <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
                            </span>
                            <h3 className="text-rose-950 font-bold text-lg flex items-center gap-2">Urgent Case Assignments Pending Acceptance</h3>
                        </div>
                        <p className="text-rose-800 text-sm">An administrator has assigned these flagged high-risk user cases to you. In compliance with active SLAs, you must Accept or Reject these assignments immediately.</p>
                        <div className="divide-y divide-rose-100 bg-white rounded-2xl border border-rose-100 overflow-hidden shadow-inner">
                            {assignedAlerts.filter(a => a.assignmentStatus === 'pending').map(itemAlert => (
                                <div key={itemAlert.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">Patient: {itemAlert.clientName}</div>
                                        <div className="text-xs font-semibold text-rose-600 mt-1">Reason: Security flag "{itemAlert.triggerKeyword}" triggered</div>
                                        {itemAlert.responseDeadline && (
                                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" /> Response SLA Deadline: {new Date(itemAlert.responseDeadline).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={async () => {
                                                await respondToRiskAssignment(itemAlert.id, CURRENT_THERAPIST_ID, 'accept');
                                                alert('Case Accepted successfully!');
                                                refreshAssignedAlerts();
                                            }}
                                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-colors"
                                        >
                                            Accept Assignment
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                await respondToRiskAssignment(itemAlert.id, CURRENT_THERAPIST_ID, 'reject');
                                                alert('Case Rejected successfully!');
                                                refreshAssignedAlerts();
                                            }}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
                                        >
                                            Reject Assignment
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Active Follow-Ups Tracker */}
                {assignedAlerts.some(a => a.assignmentStatus === 'accepted') && (
                    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-slate-900 font-bold text-lg">Active Risk Follow-Ups Tracking Queue</h3>
                        </div>
                        <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-100 overflow-hidden">
                            {assignedAlerts.filter(a => a.assignmentStatus === 'accepted').map(alert => (
                                <div key={alert.id} className="p-4 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">Patient: {alert.clientName}</div>
                                        <div className="text-xs text-slate-500 mt-1">Intervention Active • Ongoing follow-up tracking and monitoring</div>
                                    </div>
                                    <div>
                                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                                            Active Monitoring Cover
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Stat Cards Grid */}
                <div className="grid md:grid-cols-3 gap-6">
                    {/* Next Session */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">Next Session</h3>
                            {nextSession ? (
                                <>
                                    <div className="text-2xl font-bold text-slate-800 mb-1">{nextSession.time}</div>
                                    <div className="text-teal-600 font-bold text-sm mb-4">with {nextSession.clientName}</div>
                                    <a href={profile.bookingUrl} target="_blank" className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors">Join Meeting</a>
                                </>
                            ) : (
                                <div className="text-slate-400 text-sm mt-4">No sessions scheduled for today.</div>
                            )}
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-teal-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                    </div>

                    {/* Wallet */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">Wallet Balance</h3>
                            <div className="text-3xl font-bold text-slate-800 mb-1">PKR {availableBalance.toLocaleString()}</div>
                            <div className="text-amber-500 font-medium text-xs mb-4">Pending: PKR {pendingBalance.toLocaleString()}</div>
                            <button className="text-xs font-bold text-slate-400 hover:text-slate-600 underline">View History</button>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                    </div>

                    {/* Patients */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 relative overflow-hidden group">
                        <div className="relative z-10">
                            <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">Active Patients</h3>
                            <div className="text-3xl font-bold text-slate-800 mb-1">{patients.length}</div>
                            <div className="text-indigo-500 font-medium text-xs mb-4">+2 New this week</div>
                            <div className="flex -space-x-2">
                                {patients.slice(0, 4).map(p => (
                                    <div key={p.id} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                                        {p.clientName?.charAt(0) || 'P'}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                    </div>
                </div>

                {/* 3. Today's Agenda (Wide View) */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Today's Agenda</h2>
                        <span className="text-slate-400 text-sm">{new Date().toLocaleDateString()}</span>
                    </div>
                    
                    {todaysAppointments.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p>You have a clear schedule today.</p>
                            <button className="mt-4 text-teal-600 text-sm font-bold hover:underline">Edit Availability</button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {todaysAppointments.map(slot => (
                                <div key={slot.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="text-slate-900 font-bold w-20">{slot.time}</div>
                                        <div className="w-px h-8 bg-slate-200"></div>
                                        <div>
                                            <div className="font-bold text-slate-800">{slot.clientName}</div>
                                            <div className="text-xs text-slate-500">{slot.type || 'Standard Session'} • {slot.duration} mins</div>
                                        </div>
                                    </div>
                                    {slot.status === 'booked' ? (
                                        <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-xs font-bold uppercase">Confirmed</span>
                                    ) : (
                                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase animate-pulse">Payment Pending</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8 animate-pulse font-sans h-full">
                <div className="flex justify-between items-center pb-6 border-b border-slate-200/50">
                    <div className="space-y-2">
                        <div className="h-8 bg-slate-200 rounded w-48" />
                        <div className="h-4 bg-slate-200 rounded w-64" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-36 bg-slate-200/80 rounded-3xl" />
                    <div className="h-36 bg-slate-200/80 rounded-3xl" />
                    <div className="h-36 bg-slate-200/80 rounded-3xl" />
                </div>
                <div className="h-96 bg-slate-200/80 rounded-3xl" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            {/* NO INTERNAL SIDEBAR - MAIN LAYOUT CONTROLS VIEW */}
            
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative w-full">
                <div className="flex-1 overflow-y-auto p-6 md:p-10 w-full">
                    
                    {/* OVERVIEW (CONTROL CENTER) */}
                    {view === 'overview' && <OverviewView />}

                    {/* SCHEDULE VIEW */}
                    {(view === 'schedule' || view === 'calendar') && (
                        <div className="max-w-7xl mx-auto h-full flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h1 className="text-2xl font-bold text-slate-800">Weekly Calendar</h1>
                                <div className="flex gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                                    <button onClick={() => setWeekOffset(weekOffset - 1)} className="px-4 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-bold">← Prev</button>
                                    <span className="px-4 py-2 text-sm font-bold text-slate-700 border-x border-slate-100 flex items-center">Week {weekOffset === 0 ? 'Current' : (weekOffset > 0 ? `+${weekOffset}` : weekOffset)}</span>
                                    <button onClick={() => setWeekOffset(weekOffset + 1)} className="px-4 py-2 hover:bg-slate-50 rounded-lg text-slate-600 font-bold">Next →</button>
                                </div>
                            </div>

                            {sessionBookings.length > 0 && (
                                <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                                    <h2 className="text-sm font-bold text-slate-700 mb-3">Session requests</h2>
                                    <div className="space-y-2">
                                        {sessionBookings.map(booking => (
                                            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                                                <span className="font-bold text-slate-800">{booking.date} · {booking.timeSlot}</span>
                                                <span className="text-slate-500">{booking.sessionType} · {booking.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-5 gap-4 mb-8">
                                {getWeekDays(weekOffset).map((date, i) => {
                                    const dateStr = date.toISOString().split('T')[0];
                                    const daySlots = schedule.filter(s => s.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));
                                    
                                    return (
                                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 min-h-[500px] flex flex-col shadow-sm hover:shadow-md transition-shadow">
                                            <div className="font-bold text-slate-500 mb-4 pb-3 border-b border-slate-100 flex justify-between items-center">
                                                <span className="uppercase tracking-wider text-xs">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                                <span className="text-slate-800 text-lg">{date.getDate()}</span>
                                            </div>
                                            
                                            <div className="space-y-2 flex-1">
                                                {daySlots.map(slot => (
                                                    <div 
                                                        key={slot.id} 
                                                        className={`p-3 rounded-xl border cursor-pointer transition-all group relative ${
                                                            slot.status === 'booked' ? 'bg-teal-50 border-teal-100' : 
                                                            slot.status === 'pending' ? 'bg-amber-50 border-amber-100' : 
                                                            'bg-white border-slate-100 hover:border-teal-300 hover:ring-2 hover:ring-teal-50'
                                                        }`}
                                                    >
                                                        <div className={`text-xs font-bold mb-1 ${slot.status === 'available' ? 'text-slate-600' : 'text-teal-700'}`}>
                                                            {slot.time} <span className="opacity-50 font-normal">({slot.duration}m)</span>
                                                        </div>
                                                        
                                                        {slot.status === 'booked' ? (
                                                            <>
                                                                <div className="text-sm font-bold text-slate-700">{slot.clientName}</div>
                                                                <div className="text-[10px] text-slate-500">{slot.type || 'Session'}</div>
                                                                {/* Actions */}
                                                                <div className="absolute top-2 right-2 hidden group-hover:flex gap-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                                                                    <button onClick={handlePoliteDecline} className="w-6 h-6 bg-rose-50 text-rose-500 rounded flex items-center justify-center text-xs hover:bg-rose-100" title="Reschedule / Decline">✕</button>
                                                                    <button onClick={() => alert("Notes")} className="w-6 h-6 bg-slate-50 text-slate-600 rounded flex items-center justify-center text-xs hover:bg-slate-100" title="Notes">📝</button>
                                                                </div>
                                                            </>
                                                        ) : slot.status === 'pending' ? (
                                                            <>
                                                                <div className="text-sm font-bold text-amber-700">{slot.clientName}</div>
                                                                <div className="text-[10px] text-amber-600 animate-pulse">Awaiting Payment</div>
                                                            </>
                                                        ) : (
                                                            <div className="flex justify-between items-center mt-2">
                                                                <span className="text-[10px] uppercase font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">Open</span>
                                                                <button onClick={() => handleDeleteSlot(slot.id)} className="text-slate-300 hover:text-rose-500 text-xs px-2 py-1 hover:bg-rose-50 rounded">×</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <button 
                                                onClick={() => { setNewSlotDate(dateStr); setShowAddSlotModal(true); }}
                                                className="mt-4 w-full py-3 border border-dashed border-slate-300 text-slate-400 text-xs rounded-xl hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50 transition-colors font-bold"
                                            >
                                                + Add Slot
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* PATIENTS VIEW */}
                    {view === 'patients' && (
                        !selectedPatientId ? (
                            <div className="max-w-7xl mx-auto h-full">
                                <h1 className="text-3xl font-bold text-slate-800 mb-8">Patient Registry</h1>
                                <h2 className="text-xl font-bold text-slate-700 mb-4">Active Patients</h2>
                                <div className="grid md:grid-cols-3 gap-6 mb-12">
                                    {patients.map(p => (
                                        <button key={p.id} onClick={() => { setSelectedPatientId(p.clientId); setTempMeetingLink(p.meetingLink || ''); }} className="text-left bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-teal-200 transition-all group">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-bold text-lg group-hover:scale-110 transition-transform">{p.clientName?.charAt(0) || 'P'}</div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-lg group-hover:text-teal-700">{p.clientName || 'Patient'}</div>
                                                    <div className="text-xs text-slate-500">Connected since {p.lastMeeting}</div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{p.totalSessions} Sessions</span>
                                                <span className="font-bold text-teal-600">Active</span>
                                            </div>
                                        </button>
                                    ))}
                                    {patients.length === 0 && <div className="col-span-3 text-center text-slate-400 italic py-10">No active patients found.</div>}
                                </div>

                                <h2 className="text-xl font-bold text-slate-705 mb-4 pt-4 border-t border-slate-100">Previous Patients</h2>
                                <div className="grid md:grid-cols-3 gap-6">
                                    {previousPatients.map(p => {
                                        const isSending = sendingFollowupIds.includes(p.clientId);
                                        return (
                                            <div key={p.id} className="text-left bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all group flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center font-bold text-lg">{p.clientName?.charAt(0) || 'P'}</div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-lg">{p.clientName || 'Patient'}</div>
                                                            <div className="text-xs text-slate-500">Last connected {p.lastMeeting}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs mb-4">
                                                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{p.totalSessions} Sessions</span>
                                                        <span className="font-bold text-slate-400">Previous</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="mt-4 pt-4 border-t border-slate-100">
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (isSending) return;
                                                            setSendingFollowupIds(prev => [...prev, p.clientId]);
                                                            setFollowupStatusMessage('');
                                                            try {
                                                                await sendFollowupRequest(p.clientId);
                                                                setFollowupStatusMessage('Follow-up request sent successfully! Client has been notified.');
                                                            } catch (err: any) {
                                                                setFollowupStatusMessage(err.message || 'Failed to send follow-up request.');
                                                            } finally {
                                                                setSendingFollowupIds(prev => prev.filter(id => id !== p.clientId));
                                                            }
                                                        }}
                                                        disabled={isSending}
                                                        className="w-full text-center bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors cursor-pointer"
                                                    >
                                                        {isSending ? 'Sending...' : 'Send Follow-Up Request'}
                                                    </button>
                                                    {followupStatusMessage && (
                                                        <p className="text-xs text-center font-medium mt-2 text-teal-700">{followupStatusMessage}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {previousPatients.length === 0 && <div className="col-span-3 text-center text-slate-400 italic py-10">No previous patients found.</div>}
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-7xl mx-auto h-full">
                                <button onClick={() => setSelectedPatientId(null)} className="mb-6 text-sm text-slate-500 hover:text-teal-600 font-bold flex items-center gap-2">
                                    <span>←</span> Back to Registry
                                </button>
                                
                                {/* Patient Header */}
                                <div className="flex items-center gap-6 mb-8 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                                    <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-4xl font-bold text-slate-500">
                                        {selectedPatient?.clientName?.charAt(0) || 'P'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h1 className="text-3xl font-bold text-slate-800">{selectedPatient?.clientName}</h1>
                                            <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                                                {(selectedPatient?.status as string) === 'INACTIVE' ? 'Previous' : 'Weekly'}
                                            </span>
                                        </div>
                                        <div className="text-slate-500 text-sm font-medium">
                                            Last connected {selectedPatient?.lastMeeting}
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button className="px-6 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50">
                                            History
                                        </button>
                                        {(selectedPatient?.status as string) !== 'INACTIVE' && (
                                            <button onClick={() => { if (selectedPatientId) setActiveChatPatientId(selectedPatientId); }} className="px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 shadow-lg">
                                                Message
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {activeChatPatientId === selectedPatientId && (
                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8 flex flex-col h-[500px]">
                                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                            <h3 className="font-bold text-slate-700">Chat with {selectedPatient?.clientName}</h3>
                                            <button onClick={() => setActiveChatPatientId(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                                            {chatMessages.length === 0 ? (
                                                <div className="text-center py-20 text-slate-400 italic">No messages yet.</div>
                                            ) : (
                                                chatMessages.map((dm: any) => (
                                                    <div key={dm.id} className={`flex ${dm.sender_id === CURRENT_THERAPIST_ID ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${dm.sender_id === CURRENT_THERAPIST_ID ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                                                            <p className="text-sm">{dm.content}</p>
                                                            <div className={`text-[10px] mt-1 opacity-60 ${dm.sender_id === CURRENT_THERAPIST_ID ? 'text-white' : 'text-slate-500'}`}>
                                                                {new Date(dm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="p-4 border-t border-slate-100 bg-white flex gap-2">
                                            <input 
                                                className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm"
                                                placeholder="Type a message..."
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                                                dir="auto"
                                            />
                                            <button 
                                                onClick={handleSendChat}
                                                disabled={!chatInput.trim() || isSendingChat}
                                                className="px-6 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 disabled:opacity-50"
                                            >
                                                Send
                                            </button>
                                        </div>
                                    </div>
                                )}

                                 {(selectedPatient?.status as string) === 'INACTIVE' ? (
                                    <div className="bg-amber-50 border border-amber-200 text-amber-950 p-8 rounded-3xl mt-8 flex flex-col items-center text-center">
                                        <span className="text-4xl mb-3">🛡️</span>
                                        <h3 className="text-lg font-bold mb-1">Clinical Profile Protected</h3>
                                        <p className="text-sm text-balance max-w-xl text-amber-900 leading-relaxed">
                                            This patient is not currently active with you. To protect clinical boundaries and client privacy, you do not have permission to view clinical impressions, therapy history, calendar tools, or logs for inactive patients. Please send a Reconnect/Follow-Up Request or wait for them to buy message support to restore full clinical access.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-8">
                                        {/* Left Col: Clinical Info */}
                                        <div className="col-span-2 space-y-8">
                                            {/* Meeting Link Management */}
                                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                        <span>🔗</span> Virtual Meeting Link
                                                    </h3>
                                                    {!isEditingMeetingLink && (
                                                        <button onClick={() => setIsEditingMeetingLink(true)} className="text-xs font-bold text-indigo-600 hover:underline">Change Link</button>
                                                    )}
                                                </div>
                                                
                                                {isEditingMeetingLink ? (
                                                    <div className="flex gap-2">
                                                        <input 
                                                            className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm"
                                                            placeholder="Enter Zoom/Google Meet link..."
                                                            value={tempMeetingLink}
                                                            onChange={e => setTempMeetingLink(e.target.value)}
                                                        />
                                                        <button onClick={handleSaveMeetingLink} className="px-6 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700">Save</button>
                                                        <button onClick={() => setIsEditingMeetingLink(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                        <span className="text-sm text-slate-600 truncate mr-4">{selectedPatient?.meetingLink || 'No link set yet'}</span>
                                                        {selectedPatient?.meetingLink && (
                                                            <a href={selectedPatient.meetingLink} target="_blank" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Test Link</a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Clinical Impression */}
                                            <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl">
                                                <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                                                    <span>📝</span> Clinical Impression (Private)
                                                </h3>
                                                <textarea 
                                                    className="w-full bg-white/50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 placeholder-amber-900/50 outline-none resize-none h-32"
                                                    placeholder="Your private notes on personality, triggers, etc..."
                                                />
                                            </div>

                                            {/* AI Insights */}
                                            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl relative overflow-hidden">
                                                <h3 className="font-bold text-indigo-800 mb-4 flex items-center gap-2">
                                                    <span>🤖</span> Clinical Co-Pilot
                                                </h3>
                                                
                                                <div className="flex gap-2 mb-4">
                                                    <input 
                                                        className="flex-1 p-3 rounded-xl text-sm border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                        placeholder="Ask AI about this patient..."
                                                        value={aiQuery}
                                                        onChange={e => setAiQuery(e.target.value)}
                                                    />
                                                    <button onClick={askClinicalAI} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">Ask</button>
                                                </div>
                                                
                                                {aiResponse ? (
                                                    <div className="bg-white p-4 rounded-xl text-sm text-indigo-900 border border-indigo-100 animate-fade-in shadow-sm">
                                                        <strong>AI Suggestion:</strong> {aiResponse}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-indigo-400 italic pl-1">Try: "Summarize recent stress triggers" or "Suggest interventions for anxiety"</div>
                                                )}
                                            </div>

                                            {/* Session Notes History */}
                                            <div>
                                                <h3 className="font-bold text-slate-800 mb-4 text-lg">Session Notes History</h3>
                                                <div className="space-y-4">
                                                    {filteredNotes.length === 0 && <div className="text-slate-400 text-sm italic py-4">No notes recorded yet.</div>}
                                                    {filteredNotes.map(n => (
                                                        <div key={n.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                                            <div className="flex justify-between items-center mb-3">
                                                                <span className="text-xs font-bold text-slate-400 uppercase">{n.dateOfNote}</span>
                                                                <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full text-slate-600">{n.markType}</span>
                                                            </div>
                                                            <h4 className="font-bold text-slate-800 text-base mb-2">{n.title}</h4>
                                                            <p className="text-slate-600 text-sm leading-relaxed">{n.details}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Col: Add Note */}
                                        <div className="space-y-6">
                                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-6">
                                                <h4 className="font-bold text-slate-800 mb-4 text-lg">Add Session Note</h4>
                                                <input 
                                                    className="w-full mb-3 p-3 bg-slate-50 rounded-xl outline-none text-sm border border-slate-100 focus:border-teal-300 transition-colors" 
                                                    placeholder="Title / Summary"
                                                    value={noteDraft.title}
                                                    onChange={e => setNoteDraft({...noteDraft, title: e.target.value})}
                                                />
                                                <select 
                                                    className="w-full mb-3 p-3 bg-slate-50 rounded-xl outline-none text-sm border border-slate-100"
                                                    value={noteDraft.mark}
                                                    onChange={e => setNoteDraft({...noteDraft, mark: e.target.value})}
                                                >
                                                    <option>Progress</option><option>Warning</option><option>Needs Follow-up</option>
                                                </select>
                                                <textarea 
                                                    className="w-full mb-4 p-3 bg-slate-50 rounded-xl outline-none text-sm h-40 resize-none border border-slate-100 focus:border-teal-300 transition-colors" 
                                                    placeholder="Clinical observations..."
                                                    value={noteDraft.details}
                                                    onChange={e => setNoteDraft({...noteDraft, details: e.target.value})}
                                                />
                                                <button onClick={handleSaveNote} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg transition-transform hover:scale-105">Save Record</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    )}

                    {/* WALLET VIEW */}
                    {view === 'finance' && (
                        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
                            <h1 className="text-3xl font-bold text-slate-800">My Wallet</h1>
                            
                            {/* Summary Cards */}
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Available for Withdrawal</div>
                                        <div className="text-4xl font-bold text-teal-600">PKR {availableBalance.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400 mt-1">Ready for transfer</div>
                                    </div>
                                    <button 
                                        onClick={() => setShowWithdrawModal(true)} 
                                        disabled={availableBalance === 0 || !isProfileComplete}
                                        className="w-full py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors"
                                    >
                                        Request Payout
                                    </button>
                                </div>

                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-48">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pending Clearance</div>
                                        <div className="text-4xl font-bold text-amber-500">PKR {pendingBalance.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400 mt-1">Held for 29-day security cycle</div>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-400 w-1/2 animate-pulse"></div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-8 rounded-3xl shadow-lg flex flex-col justify-between h-48 text-white">
                                    <div>
                                        <div className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-2">Lifetime Earnings</div>
                                        <div className="text-4xl font-bold">PKR {lifetimeEarnings.toLocaleString()}</div>
                                    </div>
                                    <div className="text-sm font-bold opacity-90 bg-white/20 w-fit px-3 py-1 rounded-lg backdrop-blur-sm">
                                        💎 Platinum Tier
                                    </div>
                                </div>
                            </div>

                            {/* Transactions Table */}
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-slate-100">
                                    <h3 className="font-bold text-slate-700">Transaction History</h3>
                                </div>
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                        <tr><th className="p-4">Date</th><th className="p-4">Transaction ID</th><th className="p-4">Description</th><th className="p-4">Type</th><th className="p-4">Amount</th><th className="p-4">Status</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {transactions.map(t => (
                                            <tr key={t.id} className="hover:bg-slate-50">
                                                <td className="p-4 text-slate-500">{new Date(t.date).toLocaleDateString()}</td>
                                                <td className="p-4 font-mono text-[10px] text-slate-400">{t.id.split('-')[0]}***</td>
                                                <td className="p-4 font-medium text-slate-800">{t.description || 'Transaction'}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${t.type === 'Credit' ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700'}`}>{t.type}</span>
                                                </td>
                                                <td className={`p-4 font-bold ${t.type === 'Credit' ? 'text-teal-600' : 'text-rose-600'}`}>
                                                    {t.type === 'Credit' ? '+' : '-'} {t.type === 'Credit' ? t.therapistPayout.toLocaleString() : t.amount.toLocaleString()}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`flex items-center gap-1 text-xs font-bold ${t.status === 'Verified' || t.status === 'Processed' ? 'text-teal-600' : t.status === 'Pending' ? 'text-amber-600' : 'text-slate-400'}`}>
                                                        {t.status === 'Verified' || t.status === 'Processed' ? '✅' : t.status === 'Pending' ? '⏳' : '•'}
                                                        {t.status === 'Verified' ? 'Cleared' : t.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {transactions.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No transactions yet.</td></tr>}
                                    </tbody>
                                </table>
                            </div>

                            {/* Withdrawal Modal */}
                            {showWithdrawModal && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                    <div className="bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl animate-scale-in">
                                        <h3 className="text-xl font-bold text-slate-800 mb-4">Request Payout</h3>
                                        <p className="text-sm text-slate-500 mb-6">Funds will be sent to your registered {profile.bankDetails?.bankName} account.</p>
                                        
                                        <div className="mb-6">
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Amount (PKR)</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none font-bold text-xl"
                                                placeholder="0.00"
                                                max={availableBalance}
                                                value={withdrawAmount}
                                                onChange={e => setWithdrawAmount(e.target.value)}
                                            />
                                            <div className="text-right text-xs text-slate-400 mt-2">Max: {availableBalance.toLocaleString()}</div>
                                        </div>

                                        <div className="flex gap-3">
                                            <button onClick={() => setShowWithdrawModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                                            <button onClick={handleWithdraw} className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg">Confirm</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ANALYTICS & REPUTATION VIEW */}
                    {view === 'analytics' && (
                        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
                            <h1 className="text-3xl font-bold text-slate-800">Reputation & Reviews</h1>

                            {/* Career Card */}
                            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8">
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-200 to-yellow-400 p-1">
                                        <div className="w-full h-full bg-white rounded-full flex items-center justify-center font-bold text-3xl text-amber-500">
                                            {profile.name?.charAt(0) || 'D'}
                                        </div>
                                    </div>
                                    <div className="mt-3 text-center">
                                        <div className="font-bold text-slate-800 text-lg">Dr. Sarah Khan</div>
                                        <div className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-full uppercase mt-1">Gold Tier</div>
                                    </div>
                                </div>

                                <div className="flex-1 grid grid-cols-3 gap-4 text-center w-full">
                                    <div className="p-4 bg-slate-50 rounded-2xl">
                                        <div className="text-2xl font-bold text-indigo-600">{profile.loyaltyPoints?.toLocaleString()}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Loyalty Points</div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl">
                                        <div className="text-2xl font-bold text-teal-600">4.9</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Avg Rating</div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl">
                                        <div className="text-2xl font-bold text-rose-600">45</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sessions</div>
                                    </div>
                                </div>
                            </div>

                            {/* Badges */}
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 mb-4">Trophy Room</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {profile.badges?.map(b => (
                                        <div key={b.id} className={`p-4 rounded-xl border flex flex-col items-center text-center transition-all ${b.isUnlocked ? 'bg-white border-amber-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
                                            <div className="text-3xl mb-2">{b.icon}</div>
                                            <div className="font-bold text-sm text-slate-800">{b.label}</div>
                                            <div className="text-[10px] text-slate-500 mt-1">{b.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Reviews */}
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 mb-4">Client Reviews</h2>
                                <div className="space-y-4">
                                    {reviews.map(r => (
                                        <div key={r.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">
                                                        {r.clientName?.charAt(0) || 'C'}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-700">{r.clientName || 'Anonymous'}</div>
                                                        <div className="text-xs text-slate-400">{r.date}</div>
                                                    </div>
                                                </div>
                                                <div className="text-amber-400 text-sm">
                                                    {'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}
                                                </div>
                                            </div>
                                            <p className="text-slate-600 text-sm leading-relaxed mb-4">"{r.feedback}"</p>
                                            <div className="flex gap-3">
                                                <button className="text-xs font-bold text-teal-600 hover:underline">Thank Client</button>
                                                <div className="w-px bg-slate-200"></div>
                                                <button className="text-xs font-bold text-rose-400 hover:text-rose-600 hover:underline">Report</button>
                                            </div>
                                        </div>
                                    ))}
                                    {reviews.length === 0 && <div className="text-center text-slate-400 py-8">No reviews yet.</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PROFILE / SETTINGS VIEW */}
                    {view === 'profile' && (
                        <div className="max-w-4xl mx-auto w-full">
                            <h1 className="text-3xl font-bold text-slate-800 mb-6">Setup Profile</h1>
                            
                            {/* Tabs */}
                            <div className="flex gap-2 mb-8 bg-white p-1 rounded-xl border border-slate-200 w-fit shadow-sm">
                                <button onClick={() => setProfileTab('general')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${profileTab === 'general' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>General Profile</button>
                                <button onClick={() => setProfileTab('practice')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${profileTab === 'practice' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Practice & Meeting</button>
                                <button onClick={() => setProfileTab('banking')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${profileTab === 'banking' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Banking & Payouts</button>
                            </div>

                            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                                {profileTab === 'general' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Full Name</label>
                                                <input className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm font-bold" value="Dr. Sarah Khan" readOnly />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Email (Locked)</label>
                                                <input className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm text-slate-400" value="test@sukoon.com" readOnly />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Notification Preferences</label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-100 flex-1">
                                                    <input type="checkbox" checked={profile.notificationPrefs?.email} onChange={e => setProfile({...profile, notificationPrefs: {...profile.notificationPrefs!, email: e.target.checked}})} className="w-5 h-5 rounded text-teal-600" />
                                                    <span className="text-sm font-medium">Email Alerts (New Bookings)</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-100 flex-1">
                                                    <input type="checkbox" checked={profile.notificationPrefs?.sms} onChange={e => setProfile({...profile, notificationPrefs: {...profile.notificationPrefs!, sms: e.target.checked}})} className="w-5 h-5 rounded text-teal-600" />
                                                    <span className="text-sm font-medium">SMS Alerts (Reminders)</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {profileTab === 'practice' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="grid md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Professional Title</label>
                                                <select className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm font-bold" value={profile.specialty} onChange={e => setProfile({...profile, specialty: e.target.value})}>
                                                    <option value="">Select...</option>
                                                    <option>Clinical Psychologist</option>
                                                    <option>Counselor</option>
                                                    <option>Psychiatrist</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">License Number</label>
                                                <input className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm" value={profile.licenseNumber} onChange={e => setProfile({...profile, licenseNumber: e.target.value})} placeholder="e.g. 12345-X" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Years Exp.</label>
                                                <input type="number" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm" value={profile.experience} onChange={e => setProfile({...profile, experience: Number(e.target.value)})} />
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                            <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase">Services & Pricing Setup</h4>
                                            
                                            <div className="flex gap-6 mb-6">
                                                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 flex-1">
                                                    <input type="checkbox" checked={profile.offerVideo} onChange={e => setProfile({...profile, offerVideo: e.target.checked})} className="w-5 h-5 rounded text-teal-600" />
                                                    <span className="text-sm font-medium">Video Sessions</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-xl border border-slate-200 flex-1">
                                                    <input type="checkbox" checked={profile.offerChat} onChange={e => setProfile({...profile, offerChat: e.target.checked})} className="w-5 h-5 rounded text-teal-600" />
                                                    <span className="text-sm font-medium">Chat Sessions</span>
                                                </label>
                                            </div>
                                            
                                            <div className="grid md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">45 Min Session (PKR)</label>
                                                    <input type="number" className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm" placeholder="e.g. 3000" value={profile.pricing45} onChange={e => setProfile({...profile, pricing45: Number(e.target.value)})} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">60 Min Session (PKR)</label>
                                                    <input type="number" className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm" placeholder="e.g. 4000" value={profile.pricing60} onChange={e => setProfile({...profile, pricing60: Number(e.target.value)})} />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">90 Min Session (PKR)</label>
                                                    <input type="number" className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm" placeholder="e.g. 5000" value={profile.pricing90} onChange={e => setProfile({...profile, pricing90: Number(e.target.value)})} />
                                                </div>
                                            </div>

                                            <div className="mt-6 pt-6 border-t border-slate-200 bg-teal-50/20 p-4 rounded-xl">
                                                <h5 className="font-bold mb-3 text-xs uppercase text-teal-800">Paid Chat Support Pricing</h5>
                                                <div className="grid md:grid-cols-3 gap-4 mb-4">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-500 mb-1">1 Day Chat Price (PKR)</label>
                                                        <input 
                                                            type="number" 
                                                            className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm font-medium" 
                                                            placeholder="e.g. 500" 
                                                            value={paidChatPrices.price1d} 
                                                            onChange={e => setPaidChatPrices({...paidChatPrices, price1d: Number(e.target.value)})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-500 mb-1">7 Days Chat Price (PKR)</label>
                                                        <input 
                                                            type="number" 
                                                            className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm font-medium" 
                                                            placeholder="e.g. 2000" 
                                                            value={paidChatPrices.price7d} 
                                                            onChange={e => setPaidChatPrices({...paidChatPrices, price7d: Number(e.target.value)})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-500 mb-1">1 Month Chat Price (PKR)</label>
                                                        <input 
                                                            type="number" 
                                                            className="w-full p-3 bg-white rounded-xl border border-slate-200 outline-none text-sm font-medium" 
                                                            placeholder="e.g. 5000" 
                                                            value={paidChatPrices.price1m} 
                                                            onChange={e => setPaidChatPrices({...paidChatPrices, price1m: Number(e.target.value)})} 
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mb-3">Notice: Paid chat Support prices can only be updated once per calendar month.</p>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setIsPriceUpdating(true);
                                                        setPriceError('');
                                                        try {
                                                            await configurePaidChat(paidChatPrices.price1d, paidChatPrices.price7d, paidChatPrices.price1m);
                                                            alert('Paid Chat Support rates configured successfully!');
                                                        } catch (err: any) {
                                                            setPriceError(err.message || 'Failed to update rates. You can only update rates once per month.');
                                                        } finally {
                                                            setIsPriceUpdating(false);
                                                        }
                                                    }}
                                                    disabled={isPriceUpdating}
                                                    className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-705 transition-colors cursor-pointer"
                                                >
                                                    {isPriceUpdating ? 'Saving...' : 'Save Chat Support Prices'}
                                                </button>
                                                {priceError && <p className="text-xs text-rose-600 mt-2 font-medium">{priceError}</p>}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Default Meeting Link <span className="text-rose-500">*</span></label>
                                            <input 
                                                className={`w-full p-4 bg-slate-50 rounded-xl border outline-none text-sm font-mono text-teal-600 ${!profile.bookingUrl ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-100'}`}
                                                placeholder="https://meet.google.com/abc-xyz-123"
                                                value={profile.bookingUrl}
                                                onChange={e => setProfile({...profile, bookingUrl: e.target.value})}
                                            />
                                            <p className="text-xs text-slate-400 mt-2">This link is automatically sent to clients when they book.</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Public Bio <span className="text-rose-500">*</span></label>
                                            <textarea 
                                                className={`w-full p-4 bg-slate-50 rounded-xl border outline-none text-sm h-32 resize-none ${!profile.bio ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-100'}`}
                                                placeholder="Write a short, welcoming introduction for clients..."
                                                value={profile.bio}
                                                onChange={e => setProfile({...profile, bio: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                )}

                                {profileTab === 'banking' && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="flex justify-between items-center bg-teal-50 p-3 rounded-lg border border-teal-100 text-teal-800 text-sm">
                                            <span>🟢 Payout Status: <strong>Active</strong></span>
                                            {profile.bankDetailsLocked && (
                                                <span className="text-rose-600 text-xs font-bold flex items-center gap-1">
                                                    🔒 Details Locked. Contact Support to change.
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Bank Name</label>
                                                <select disabled={profile.bankDetailsLocked} className={`w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm ${profile.bankDetailsLocked ? 'opacity-60 cursor-not-allowed' : ''}`} value={profile.bankDetails?.bankName} onChange={e => setProfile({...profile, bankDetails: {...profile.bankDetails!, bankName: e.target.value}})}>
                                                    <option value="">Select Bank...</option>
                                                    <option>HBL</option><option>Meezan Bank</option><option>EasyPaisa</option><option>JazzCash</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Account Title</label>
                                                <input disabled={profile.bankDetailsLocked} className={`w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none text-sm ${profile.bankDetailsLocked ? 'opacity-60 cursor-not-allowed' : ''}`} placeholder="Must match ID" value={profile.bankDetails?.accountTitle} onChange={e => setProfile({...profile, bankDetails: {...profile.bankDetails!, accountTitle: e.target.value}})} />
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">IBAN / Account Number</label>
                                            <input 
                                                disabled={profile.bankDetailsLocked}
                                                className={`w-full p-4 bg-slate-50 rounded-xl border outline-none text-sm font-mono ${!profile.bankDetails?.iban ? 'border-rose-300' : 'border-slate-100'} ${profile.bankDetailsLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                placeholder="PK00 HABB 0000 0000 0000 0000 0000 0000"
                                                value={profile.bankDetails?.iban}
                                                onChange={e => setProfile({...profile, bankDetails: {...profile.bankDetails!, iban: e.target.value}})}
                                            />
                                        </div>

                                        <div className="space-y-2 mt-4">
                                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                                <input type="checkbox" checked readOnly className="w-4 h-4 text-teal-600" />
                                                I agree to the 20% Platform Commission.
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                                <input type="checkbox" checked readOnly className="w-4 h-4 text-teal-600" />
                                                I understand payouts are processed on a 29-Day Rolling Cycle.
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                                    <button onClick={handleSaveProfile} className="px-8 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 shadow-lg transition-transform hover:scale-105">Save Changes</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SUPPORT VIEW */}
                    {view === 'support' && (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex justify-between items-center mb-8">
                                <h1 className="text-3xl font-bold text-slate-800">Support Center</h1>
                                <button onClick={() => setShowSupportModal(true)} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-lg flex items-center gap-2">
                                    <span>📩</span> Open New Ticket
                                </button>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6 mb-12">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                    <div className="text-2xl mb-2">💰</div>
                                    <h3 className="font-bold text-slate-800">Payout Issues</h3>
                                    <p className="text-xs text-slate-500 mt-1">Payment didn't arrive? Check our 29-day policy first.</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                    <div className="text-2xl mb-2">📅</div>
                                    <h3 className="font-bold text-slate-800">Scheduling</h3>
                                    <p className="text-xs text-slate-500 mt-1">Trouble with calendar slots or double booking?</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                    <div className="text-2xl mb-2">📹</div>
                                    <h3 className="font-bold text-slate-800">Tech Support</h3>
                                    <p className="text-xs text-slate-500 mt-1">Video link errors or dashboard bugs.</p>
                                </div>
                            </div>

                            <h3 className="font-bold text-slate-700 mb-4">Frequently Asked Questions</h3>
                            <div className="space-y-3">
                                {[
                                    {q: "When do I get paid?", a: "Payouts are processed 29 days after a session is marked complete."},
                                    {q: "How do I reschedule?", a: "Use the Polite Decline feature in your calendar to offer priority slots."},
                                    {q: "Can I use WhatsApp?", a: "No. Off-platform contact leads to immediate disqualification."}
                                ].map((faq, i) => (
                                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-200">
                                        <div className="font-bold text-slate-800 text-sm mb-1">{faq.q}</div>
                                        <div className="text-slate-600 text-sm">{faq.a}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* RESOURCE PAGES VIEW */}
                    {view === 'code-of-conduct' && <CodeOfConductPage />}
                    {view === 'guidelines' && <ClinicalGuidelinesPage />}
                    {view === 'crisis-protocol' && <CrisisProtocolPage />}
                    {view === 'payout-policy' && <PayoutPolicyPage />}
                    {view === 'non-circumvention' && <NonCircumventionPage />}
                    {view === 'report-incident' && <ReportIncidentPage />}

                </div>

                {/* Footer */}
                <footer className="bg-white border-t border-slate-200 p-8 w-full">
                    <div className="max-w-7xl mx-auto grid grid-cols-4 gap-8 text-xs text-slate-500">
                        <div>
                            <div className="font-bold text-slate-900 text-sm mb-2">Sukoon Professional</div>
                            <p>System Online ● v2.5</p>
                            <p className="mt-1 font-mono">{CURRENT_THERAPIST_ID}</p>
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 mb-2">Practice Resources</div>
                            <ul className="space-y-2">
                                {/* Note: In real app, these would navigation links via App.tsx, here simplified */}
                                <li>Code of Conduct & Ethics</li>
                                <li>Clinical Guidelines</li>
                                <li>Crisis Protocol</li>
                                <li>Payout Policy</li>
                            </ul>
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 mb-2">Legal & Safety</div>
                            <ul className="space-y-2">
                                <li>Terms (Non-Circumvention)</li>
                                <li>Privacy Policy (HIPAA)</li>
                                <li>Report Safety Incident</li>
                            </ul>
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 mb-2">Support Center</div>
                            <p>admin-hotline@sukoon.com</p>
                            <button onClick={() => setShowSupportModal(true)} className="mt-2 text-teal-600 underline">Open Support Ticket</button>
                        </div>
                    </div>
                    <div className="text-center mt-8 text-[10px] text-slate-300">© 2025 Sukoon Health. All Rights Reserved.</div>
                </footer>

                {/* Floating Help Button */}
                <button 
                    onClick={() => { setShowSupportModal(true); }}
                    className="absolute bottom-8 right-8 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl font-bold hover:scale-110 transition-transform z-30"
                >
                    ?
                </button>

                {/* Add Slot Modal */}
                {showAddSlotModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white w-full max-w-sm p-6 rounded-2xl shadow-xl animate-scale-in">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Set Availability</h3>
                            <p className="text-sm text-slate-500 mb-4">Add a slot for {newSlotDate}</p>
                            
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Start Time</label>
                                    <select 
                                        className="w-full p-3 bg-slate-50 rounded-xl outline-none text-sm"
                                        value={newSlotData.time}
                                        onChange={e => setNewSlotData({...newSlotData, time: e.target.value})}
                                    >
                                        <option>09:00 AM</option><option>10:00 AM</option><option>11:00 AM</option>
                                        <option>12:00 PM</option><option>01:00 PM</option><option>02:00 PM</option>
                                        <option>03:00 PM</option><option>04:00 PM</option><option>05:00 PM</option>
                                        <option>06:00 PM</option><option>07:00 PM</option><option>08:00 PM</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Duration</label>
                                    <div className="flex gap-2">
                                        {[30, 45, 60, 90].map(dur => (
                                            <button 
                                                key={dur}
                                                onClick={() => setNewSlotData({...newSlotData, duration: dur})}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${newSlotData.duration === dur ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                                            >
                                                {dur}m
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setShowAddSlotModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                                <button onClick={handleAddSlot} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg">Add Slot</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Support Modal */}
                {showSupportModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 h-full">
                        <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6">Submit Ticket</h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Issue Category</label>
                                    <select 
                                        className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                                        value={ticketData.type}
                                        onChange={e => setTicketData({...ticketData, type: e.target.value})}
                                    >
                                        <option>General Inquiry</option>
                                        <option>Payment Issue</option>
                                        <option>Booking Issue</option>
                                        <option>Therapist Issue</option>
                                        <option>Technical Issue</option>
                                        <option>Account Verification</option>
                                        <option>Refund Request</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                                    <div className="flex gap-2">
                                        {['Low', 'Medium', 'High'].map(p => (
                                            <button 
                                                key={p} type="button"
                                                onClick={() => setTicketData({...ticketData, priority: p})}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${(ticketData as any).priority === p ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                    <input 
                                        className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                                        placeholder="Brief title..."
                                        value={ticketData.subject}
                                        onChange={e => setTicketData({...ticketData, subject: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                    <textarea 
                                        className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none h-32 resize-none"
                                        placeholder="Please describe the issue..."
                                        value={ticketData.description}
                                        onChange={e => setTicketData({...ticketData, description: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Attachment (Optional)</label>
                                    <input 
                                        type="file" 
                                        accept="image/*,.pdf"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = () => setTicketData(prev => ({ ...prev, imageUrl: reader.result as string }));
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button onClick={() => setShowSupportModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                                <button onClick={handleSubmitTicket} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg">Submit Ticket</button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};
