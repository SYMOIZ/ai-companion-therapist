
import { 
    MarketingExpense, FinanceStats, PayoutRequest, UserSettings, Notification, Broadcast, 
    AdminStats, Therapist, TherapistApplication, AdminUserView, AdminAlert, Transaction, 
    Investment, ChatThread, SystemHealth, MonetizationConfig, TherapistConnection, 
    SystemNotification, TeamMember, CompanyExpense, TherapyNote, SupportTicket, Review, 
    CalendarSlot, SafetyIncident, RiskAlert, UserFeedback, BugReport, SessionRating,
    Message, Session, JournalEntry
} from '../types';
import { supabase } from './supabaseClient';
import { classifyMessageRisk } from './openaiService';

// --- HELPER: Admin Logger ---
export const getUserPlanLimits = async (userId: string) => {
    try {
        const subRes = await supabase.from('user_subscriptions').select('*, plan:subscription_plans(*)').eq('user_id', userId).eq('status', 'Active').single();
        if (subRes.data && subRes.data.plan) {
            if (new Date(subRes.data.expiry_date) <= new Date()) {
                await supabase.from('user_subscriptions').update({ status: 'Expired' }).eq('id', subRes.data.id);
            } else {
                return subRes.data.plan;
            }
        }
    } catch(e) {}
    
    // Default to Free
    const freeRes = await supabase.from('subscription_plans').select('*').eq('name', 'Free').single();
    if (freeRes.data) return freeRes.data;
    return { max_ai_chats: 10, max_journal_entries: 30, premium_features: 0 };
};

const logAdminAction = async (action: string, details: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await supabase.from('admin_actions').insert({
            admin_id: user.id,
            action_type: action,
            details: details,
            created_at: new Date().toISOString()
        });
    }
};

export const getRevenueTrend = async () => {
    try {
        const { data, error } = await supabase.from('wallet_transactions')
            .select('amount, date')
            .eq('type', 'Credit')
            .eq('status', 'Verified')
            .order('date', { ascending: true });

        if (error || !data) return [];

        // Aggregate by month (simple grouping)
        const monthlyData: Record<string, number> = {};
        data.forEach((tx: any) => {
            const date = new Date(tx.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + Number(tx.amount || 0);
        });

        return Object.entries(monthlyData).map(([month, revenue]) => ({ month, revenue }));
    } catch (e) {
        console.error("Failed to get revenue trend:", e);
        return [];
    }
};

// --- FINANCE (Connected to:...

export const getFinanceStats = async (): Promise<FinanceStats> => {
    try {
        // Parallel fetching for better performance
        const [expensesRes, payoutsRes, creditsRes, txsRes] = await Promise.all([
            supabase.from('marketing_expenses').select('amount'),
            supabase.from('payout_requests').select('amount, status'),
            supabase.from('wallet_transactions').select('amount, therapist_payout').eq('type', 'Credit').eq('status', 'Verified'),
            supabase.from('wallet_transactions').select('therapist_id, client_id, amount').eq('type', 'Credit')
        ]);

        const expenses = expensesRes?.data || [];
        const payouts = payoutsRes?.data || [];
        const credits = creditsRes?.data || [];
        const txs = txsRes?.data || [];

        // 1. Marketing Expenses
        const totalExpenses = expenses.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

        // 2. Payouts
        const pendingPayouts = payouts.filter((p: any) => p && p.status === 'Pending').reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
        const clearedPayouts = payouts.filter((p: any) => p && p.status === 'Processed').reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

        // 3. Revenue
        const totalRevenue = credits.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
        const totalTherapistShare = credits.reduce((acc: number, curr: any) => acc + Number(curr.therapist_payout || 0), 0);
        const grossProfit = totalRevenue - totalTherapistShare;
        const netIncome = grossProfit - totalExpenses;

        // 4. Top Performers (Aggregation)
        const therapistMap: Record<string, number> = {};
        txs.forEach((t: any) => { 
            if (t && t.therapist_id) {
                therapistMap[t.therapist_id] = (therapistMap[t.therapist_id] || 0) + Number(t.amount || 0); 
            }
        });
        const topTId = Object.keys(therapistMap).reduce((a: string, b: string) => therapistMap[a] > therapistMap[b] ? a : b, '');
        
        const clientMap: Record<string, number> = {};
        txs.forEach((t: any) => { 
            if (t && t.client_id) {
                clientMap[t.client_id] = (clientMap[t.client_id] || 0) + Number(t.amount || 0); 
            }
        });
        const topSId = Object.keys(clientMap).reduce((a: string, b: string) => clientMap[a] > clientMap[b] ? a : b, '');

        // Fetch names in parallel
        const [topTherapistRes, topClientRes] = await Promise.all([
            topTId ? supabase.from('users').select('display_name').eq('id', topTId).single() : Promise.resolve({ data: null }),
            topSId ? supabase.from('users').select('display_name').eq('id', topSId).single() : Promise.resolve({ data: null })
        ]);

        const topTherapistName = topTherapistRes?.data?.display_name || 'Unknown';
        const topClientName = topClientRes?.data?.display_name || 'Unknown';

        return {
            revenue: totalRevenue,
            profit: grossProfit,
            marketing: totalExpenses,
            net_income: netIncome,
            pending_payouts: pendingPayouts,
            cleared_payouts: clearedPayouts,
            top_therapist: { name: topTherapistName, total: therapistMap[topTId] || 0 },
            top_client: { name: topClientName, total: clientMap[topSId] || 0 },
            most_active: { name: 'None', sessions: 0 }
        };
    } catch (e) {
        console.error("Failed to fetch finance stats:", e);
        return {
            revenue: 0,
            profit: 0,
            marketing: 0,
            net_income: 0,
            pending_payouts: 0,
            cleared_payouts: 0,
            top_therapist: { name: 'None', total: 0 },
            top_client: { name: 'None', total: 0 },
            most_active: { name: 'None', sessions: 0 }
        };
    }
};

export const getMarketingExpenses = async (): Promise<MarketingExpense[]> => {
    try {
        const { data, error } = await supabase.from('marketing_expenses').select('*').order('date', { ascending: false });
        if (error) {
            console.error("Expense Fetch Error:", error.message);
            return [];
        }
        return (data || []).map((d: any) => ({...d, date: new Date(d.date || Date.now()).getTime()}));
    } catch (e) {
        console.error("Failed to get marketing expenses:", e);
        return [];
    }
};

export const addMarketingExpense = async (expense: Omit<MarketingExpense, 'id' | 'date'>) => {
    await supabase.from('marketing_expenses').insert({
        platform: expense.platform,
        amount: expense.amount,
        description: expense.description,
        date: new Date().toISOString()
    });
    await logAdminAction('add_expense', { amount: expense.amount, platform: expense.platform });
};

// --- PAYOUTS (Connected to: payout_requests) ---

export const getPayoutRequests = async (): Promise<PayoutRequest[]> => {
    const { data, error } = await supabase.from('payout_requests').select('*').order('request_date', { ascending: false });
    if (error) console.error("Payout Fetch Error:", error.message);
    return (data || []).map((d: any) => ({
        id: d.id,
        therapistId: d.therapist_id,
        therapistName: d.therapist_name,
        amount: d.amount,
        status: d.status,
        requestDate: new Date(d.request_date).getTime(),
        method: d.method,
        processedAt: d.processed_at ? new Date(d.processed_at).getTime() : undefined
    }));
};

export const processPayout = async (id: string, status: 'Processed' | 'Rejected', reason?: string) => {
    // Get the payout request to know which user and how much
    const { data: payoutData } = await supabase.from('payout_requests')
        .select('*')
        .eq('id', id)
        .single();

    const { error } = await supabase.from('payout_requests').update({
        status,
        processed_at: new Date().toISOString()
    }).eq('id', id);
    
    if (!error && payoutData) {
        // Also update the matching pending debit transaction in wallet_transactions
        // Match by user_id and amount, and being 'Pending' Debit. (In a real app we'd save txId on the payout request)
        const { data: txs } = await supabase.from('wallet_transactions')
            .select('*')
            .eq('user_id', payoutData.therapist_id)
            .eq('type', 'Debit')
            .eq('status', 'Pending')
            .eq('amount', payoutData.amount)
            .limit(1);

        if (txs && txs.length > 0) {
            await supabase.from('wallet_transactions')
                .update({ status: status === 'Processed' ? 'Verified' : 'Rejected' })
                .eq('id', txs[0].id);
        }

        // Notify Therapist
        if (status === 'Processed') {
            await createNotification(
                payoutData.therapist_id,
                'Payout Approved & Processed',
                `Your withdrawal request for PKR ${payoutData.amount} has been processed and sent to your bank.`,
                'system'
            );
        } else if (status === 'Rejected') {
            if (reason) {
                await createNotification(
                    payoutData.therapist_id,
                    'More Information Required',
                    `Your withdrawal request for PKR ${payoutData.amount} requires more information: ${reason}. Please update your settings or open a ticket.`,
                    'system'
                );
            } else {
                await createNotification(
                    payoutData.therapist_id,
                    'Payout Request Rejected',
                    `Your withdrawal request for PKR ${payoutData.amount} was rejected. Please check your banking details or contact support.`,
                    'system'
                );
            }
        }

        await logAdminAction('process_payout', { id, status, reason });
    }
    return !error;
};

export const requestPayout = async (amount: number, details: any) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    
    const payoutId = crypto.randomUUID();
    // Create Payout Request
    await supabase.from('payout_requests').insert({
        id: payoutId,
        therapist_id: user.id,
        therapist_name: user.user_metadata?.name || 'Unknown',
        amount,
        status: 'Pending',
        request_date: new Date().toISOString(),
        method: `${details.bankName} - ${details.iban} (${details.accountTitle})`
    });

    const txId = crypto.randomUUID();
    // Create Debit Transaction in Wallet
    await supabase.from('wallet_transactions').insert({
        id: txId,
        user_id: user.id,
        amount: amount,
        type: 'Debit',
        status: 'Pending', // Pending admin approval
        description: 'Withdrawal Request',
        date: new Date().toISOString(),
        therapist_payout: 0
    });

    await createNotification(
        user.id,
        'Payout Request Submitted',
        `Your request to withdraw PKR ${amount} is pending admin review.`,
        'system'
    );

    const { data: admins } = await supabase.from('users').select('id').eq('is_admin', 1);
    if (admins && admins.length > 0) {
        for (const ad of admins) {
            await createNotification(ad.id, "New Payout Request", `Therapist ${user.user_metadata?.name || 'Unknown'} requested a payout of PKR ${amount}.`, "system");
        }
    }
};

export const getTransactions = async (): Promise<Transaction[]> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return [];

    const { data } = await supabase.from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    return (data || []).map((t: any) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        type: t.type,
        amount: t.amount,
        status: t.status,
        therapistPayout: t.therapist_payout
    }));
};

// --- THERAPISTS & USERS (Connected to: users, therapist_profiles, therapist_applications) ---

export const checkConnection = async (): Promise<{ status: 'connected' | 'error', details?: any }> => {
    try {
        const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
        if (error) throw error;
        return { status: 'connected', details: { userCount: count } };
    } catch (e: any) {
        return { status: 'error', details: { message: e.message } };
    }
};

let cachedTherapists: Therapist[] | null = null;

export const clearTherapistsCache = () => {
    cachedTherapists = null;
};

export const getTherapists = async (): Promise<Therapist[]> => {
    if (cachedTherapists) {
        console.log(`[Cache Hit] getTherapists`);
        return cachedTherapists;
    }
    try {
        // Join users with profiles
        const { data, error } = await supabase.from('users')
            .select(`
                id, email, display_name, role, account_status,
                therapist_profiles (*),
                calendar_slots (id, date, time, status, duration)
            `)
            .eq('role', 'therapist');

        if (error || !data) return [];

        // Fetch approved boosts and subscriptions to apply badges / directory sorting
        let boosts: any[] = [];
        let subs: any[] = [];
        try {
            const { data: bData } = await supabase.from('therapist_boosts').select('*').eq('status', 'Approved');
            boosts = bData || [];
        } catch (boostErr) {
            console.warn("Could not retrieve therapist boosts:", boostErr);
        }

        try {
            const { data: sData } = await supabase.from('therapist_subscriptions').select('*').eq('status', 'Approved');
            subs = sData || [];
        } catch (subErr) {
            console.warn("Could not retrieve therapist subscriptions:", subErr);
        }

        const now = new Date().toISOString();
        const activeBoosts = boosts.filter((b: any) => !b.expires_at || b.expires_at >= now);
        const activeSubs = subs.filter((s: any) => !s.expires_at || s.expires_at >= now);
        
        const mapped = data.map((u: any) => {
            const profile = u.therapist_profiles || {}; // One-to-one mapping usually
            const matchBoost = activeBoosts.find((b: any) => b.therapist_id === u.id);
            const matchSub = activeSubs.find((s: any) => s.therapist_id === u.id);
            const rawSlots = u.calendar_slots || [];
            const availableSlots = rawSlots.filter((slot: any) => slot.status === 'available').map((slot: any) => ({
                id: slot.id,
                day: slot.date,
                time: slot.time
            }));

            return {
                id: u.id,
                name: u.display_name,
                email: u.email,
                specialty: profile.specialty || 'General Therapist',
                bio: profile.bio || '',
                languages: profile.languages || ['English'],
                experience: profile.experience || 0,
                rating: profile.rating || 5.0,
                reviewCount: profile.review_count || 0,
                bookingUrl: profile.booking_url || '',
                status: u.account_status === 'active' ? 'LIVE' : 'PENDING',
                isCrisisCertified: profile.is_crisis_certified,
                licenseNumber: profile.license_number,
                bankDetails: profile.bank_details,
                clinicalSpecializations: profile.clinical_specializations,
                loyaltyPoints: profile.loyalty_points,
                approvalStatus: profile.approval_status || 'pending',
                pricing45: profile.pricing_45 || 0,
                pricing60: profile.pricing_60 || 0,
                pricing90: profile.pricing_90 || 0,
                offerVideo: profile.offer_video !== 0,
                offerChat: profile.offer_chat !== 0,
                bankDetailsLocked: profile.bank_details_locked !== 0,
                violationStrikes: profile.violation_strikes || 0,
                cvFileName: null, // Usually stored in applications table, not profile
                degreeFileName: null,
                availableSlots: availableSlots,
                isPro: !!matchSub,
                boostLevel: matchBoost ? matchBoost.package_type : null
            };
        });
        cachedTherapists = mapped;
        return mapped;
    } catch (e) {
        console.error("Critical error in getTherapists:", e);
        return [];
    }
};

export const getTherapistApplications = async (): Promise<TherapistApplication[]> => {
    const { data } = await supabase.from('therapist_applications').select('*');
    return (data || []).map((a: any) => ({
        id: a.id,
        userId: a.user_id,
        fullName: a.full_name,
        email: a.email,
        phone: a.phone,
        yearsExperience: a.years_experience,
        specialization: a.specialization,
        licenseNumber: a.license_number,
        cvFileName: a.cv_file,
        degreeFileName: a.degree_file,
        status: a.status,
        submittedAt: new Date(a.submitted_at).getTime()
    }));
};

export const approveTherapistApplication = async (appId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const response = await fetch('/api/admin/approve-therapist', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appId })
    });
    if (!response.ok) throw new Error('Failed to approve application');
    clearTherapistsCache();
    return await response.json();
};

export const rejectTherapistApplication = async (appId: string, reason?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    const response = await fetch('/api/admin/reject-therapist', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appId, reason: reason || '' })
    });
    if (!response.ok) throw new Error('Failed to reject application');
    clearTherapistsCache();
    return await response.json();
};

export const updateTherapistProfile = async (id: string, data: any) => {
    const { error } = await supabase.from('therapist_profiles').upsert({
        user_id: id,
        bio: data.bio,
        specialty: data.specialty,
        booking_url: data.bookingUrl,
        experience: data.experience,
        license_number: data.licenseNumber,
        bank_details: data.bankDetails,
        notification_prefs: data.notificationPrefs,
        clinical_specializations: data.clinicalSpecializations,
        pricing_45: data.pricing45 || 0,
        pricing_60: data.pricing60 || 0,
        pricing_90: data.pricing90 || 0,
        offer_video: data.offerVideo === false ? 0 : 1,
        offer_chat: data.offerChat === false ? 0 : 1,
        bank_details_locked: data.bankDetailsLocked ? 1 : 0,
        updated_at: new Date().toISOString()
    });
    if (error) console.error("Profile Update Error", error.message);
};

export const unlockTherapistBankDetails = async (therapistId: string) => {
    await supabase.from('therapist_profiles').update({ bank_details_locked: 0 }).eq('user_id', therapistId);
    await createNotification(
        therapistId,
        'Bank Details Unlocked',
        'An admin has unlocked your banking details. You can now update them in your Practice Settings.',
        'system'
    );
};

export const getAdminUsers = async (): Promise<AdminUserView[]> => {
    try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) {
            console.error("Error fetching users for admin:", error);
            return [];
        }
        return (data || []).map((u: any) => ({
            id: u.id,
            name: u.display_name,
            email: u.email,
            age: u.age,
            gender: u.gender,
            region: u.region,
            profession: u.profession,
            riskLevel: 'low', // Would need logic from risk_alerts to populate this
            status: u.account_status
        }));
    } catch (e) {
        console.error("Failed to run getAdminUsers:", e);
        return [];
    }
};

// --- SUPPORT & FEEDBACK (Connected to: support_tickets, user_feedback, bug_reports, reviews) ---

export const getReviews = async (therapistId: string): Promise<Review[]> => {
    try {
        const { data, error } = await supabase.from('reviews').select('*').eq('therapist_id', therapistId).order('created_at', { ascending: false });
        if (error) {
            console.error("Error retrieving reviews from DB:", error);
            return [];
        }
        return (data || []).map((r: any) => ({
            id: r.id,
            therapistId: r.therapist_id,
            clientName: r.client_name, // If relation exists, use r.users.display_name
            rating: r.rating,
            feedback: r.comment,
            date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'
        }));
    } catch (e) {
        console.error("Failed to run getReviews:", e);
        return [];
    }
};

export const saveRating = async (rating: SessionRating) => {
    await supabase.from('session_ratings').insert({
        session_id: rating.sessionId,
        rating: rating.rating,
        remark: rating.remark,
        created_at: new Date(rating.timestamp).toISOString()
    });
};

export const saveBugReport = async (report: any, isAnon: boolean) => {
    await supabase.from('bug_reports').insert({
        user_id: report.userId,
        session_id: report.sessionId,
        issue_type: report.issueType,
        description: report.description,
        device_info: report.deviceInfo,
        status: 'new',
        created_at: new Date(report.timestamp).toISOString()
    });
};

export const saveUserFeedback = async (feedback: any, isAnon: boolean) => {
    await supabase.from('user_feedback').insert({
        user_id: feedback.userId,
        feedback_type: feedback.feedbackType,
        category: feedback.category,
        note: feedback.note,
        created_at: new Date(feedback.timestamp).toISOString()
    });
};

export const getClientFeedback = async (): Promise<UserFeedback[]> => {
    const { data } = await supabase.from('user_feedback').select(`*, users(display_name, email)`).order('created_at', { ascending: false });
    return (data || []).map((f: any) => ({
        id: f.id,
        userId: f.user_id,
        feedbackType: f.feedback_type,
        category: f.category,
        note: f.note,
        timestamp: new Date(f.created_at).getTime(),
        userName: f.users?.display_name || 'Anon',
        userEmail: f.users?.email || '',
        status: f.status || 'Pending',
        metadata: f.metadata
    }));
};

export const updateFeedbackStatus = async (id: string, status: string, note: string) => {
    await supabase.from('user_feedback').update({ status, metadata: { admin_note: note } }).eq('id', id);
};

export const saveSupportTicket = async (ticket: SupportTicket) => {
    const user = (await supabase.auth.getUser()).data.user;
    
    await supabase.from('support_tickets').insert({
        id: ticket.id,
        user_id: user?.id,
        user_email: user?.email,
        user_name: user?.user_metadata?.name,
        type: ticket.type,
        priority: ticket.priority,
        subject: ticket.subject,
        description: ticket.description,
        image_url: ticket.imageUrl,
        status: 'Open',
        created_at: new Date().toISOString()
    });

    const { data: admins } = await supabase.from('users').select('id').eq('is_admin', 1);
    if (admins && admins.length > 0) {
        for (const ad of admins) {
            await createNotification(ad.id, "New Support Ticket", `${ticket.subject} (Priority: ${ticket.priority})`, "system");
        }
    }
    
    // Also add the initial description as the first message into the thread
    await supabase.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        sender_id: user?.id,
        sender_name: user?.user_metadata?.name || 'User',
        sender_type: 'user',
        content: ticket.description,
        created_at: new Date().toISOString()
    });

    // Notify user
    if (user?.id) {
         await createNotification(user.id, "Ticket Created", `We've received your ticket: ${ticket.subject}`, "system");
    }
};

export const getSupportTickets = async (): Promise<SupportTicket[]> => {
    const { data } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
    return (data || []).map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        userName: t.user_name,
        userEmail: t.user_email,
        type: t.type,
        priority: t.priority || 'Low',
        subject: t.subject,
        description: t.description,
        imageUrl: t.image_url,
        status: t.status,
        created_at: t.created_at,
        timestamp: new Date(t.created_at).getTime(),
        admin_response: t.admin_response
    }));
};

export const getUserSupportTickets = async (): Promise<SupportTicket[]> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return [];
    const { data } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    return (data || []).map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        userName: t.user_name,
        userEmail: t.user_email,
        type: t.type,
        priority: t.priority || 'Low',
        subject: t.subject,
        description: t.description,
        imageUrl: t.image_url,
        status: t.status,
        created_at: t.created_at,
        timestamp: new Date(t.created_at).getTime(),
        admin_response: t.admin_response
    }));
};

export const getTicketMessages = async (ticketId: string) => {
    const { data } = await supabase.from('support_ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    return (data || []).map((m: any) => ({
        id: m.id,
        ticket_id: m.ticket_id,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        sender_type: m.sender_type,
        content: m.content,
        created_at: m.created_at
    }));
};

export const sendTicketMessage = async (ticketId: string, content: string, asAdmin: boolean) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return null;

    const { error } = await supabase.from('support_ticket_messages').insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_name: user.user_metadata?.name || (asAdmin ? 'Admin' : 'User'),
        sender_type: asAdmin ? 'admin' : 'user',
        content: content,
        created_at: new Date().toISOString()
    });

    if (!error) {
        // Find ticket to notify the other party
        const { data: ticket } = await supabase.from('support_tickets').select('user_id, status').eq('id', ticketId).single();
        if (ticket) {
            if (asAdmin) {
                // Admin replied, update status
                await supabase.from('support_tickets').update({ status: 'Waiting for User', admin_response: content }).eq('id', ticketId);
                await createNotification(ticket.user_id, 'Help Desk Reply', `Admin replied to your ticket.`, 'system');
            } else {
                // User replied, update status
                await supabase.from('support_tickets').update({ status: 'In Progress' }).eq('id', ticketId);
                const { data: admins } = await supabase.from('users').select('id').eq('is_admin', 1);
                if (admins && admins.length > 0) {
                    for (const ad of admins) {
                        await createNotification(ad.id, "New Ticket Reply", `User replied to ticket #${ticketId.substring(0,6)}`, "system");
                    }
                }
            }
        }
    }
    return !error;
};

export const resolveSupportTicket = async (id: string, reply: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    
    if (reply) {
         await supabase.from('support_ticket_messages').insert({
            ticket_id: id,
            sender_id: user?.id,
            sender_name: 'Admin',
            sender_type: 'admin',
            content: reply,
            created_at: new Date().toISOString()
        });
    }

    await supabase.from('support_tickets').update({
        status: 'Resolved',
        admin_response: reply,
        resolved_at: new Date().toISOString()
    }).eq('id', id);

    const { data: ticket } = await supabase.from('support_tickets').select('user_id').eq('id', id).single();
    if (ticket?.user_id) {
         await createNotification(ticket.user_id, 'Ticket Resolved', `Your support ticket has been marked as resolved.`, 'system');
    }
};

export const closeSupportTicket = async (id: string) => {
    await supabase.from('support_tickets').update({
        status: 'Closed'
    }).eq('id', id);

    const { data: ticket } = await supabase.from('support_tickets').select('user_id').eq('id', id).single();
    if (ticket?.user_id) {
         await createNotification(ticket.user_id, 'Ticket Closed', `Your support ticket has been closed.`, 'system');
    }
};

// --- SAFETY & ALERTS (Connected to: risk_alerts, safety_incidents, emergency_sessions) ---

export const triggerRiskAlert = async (alertData: any) => {
    const id = alertData.id || `alrt-${Math.random().toString(36).substring(2, 10)}`;
    await supabase.from('risk_alerts').insert({
        id: id,
        user_id: alertData.userId,
        client_name: alertData.userName || alertData.clientName || 'Anonymous User',
        trigger_keyword: alertData.triggerKeyword || 'HIGH',
        message: alertData.message,
        detected_at: alertData.detectedAt || new Date().toISOString(),
        status: alertData.status || 'Active'
    });
};

export const getActiveUserRiskAlerts = async (userId: string): Promise<RiskAlert[]> => {
    if (!userId || userId === 'guest') return [];
    try {
        const { data, error } = await supabase.from('risk_alerts')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'Active');
        if (error) {
            console.error("Error fetching user risk alerts:", error);
            return [];
        }
        return (data || []).map((a: any) => ({
            id: a.id,
            clientId: a.user_id,
            clientName: a.client_name,
            triggerKeyword: a.trigger_keyword,
            detectedAt: new Date(a.detected_at).getTime(),
            status: a.status
        }));
    } catch (e) {
         console.error("Error in getActiveUserRiskAlerts:", e);
         return [];
    }
};

export const getRiskAlerts = async (): Promise<RiskAlert[]> => {
    const { data } = await supabase.from('risk_alerts').select('*').order('detected_at', { ascending: false });
    return (data || []).map((a: any) => ({
        id: a.id,
        clientId: a.user_id,
        clientName: a.client_name,
        triggerKeyword: a.trigger_keyword,
        detectedAt: new Date(a.detected_at).getTime(),
        status: a.status,
        message: a.message,
        assignedTherapistId: a.assigned_therapist_id,
        assignmentStatus: a.assignment_status,
        assignedAt: a.assigned_at,
        responseDeadline: a.response_deadline,
        followupStatus: a.followup_status
    }));
};

export const reportSafetyIncident = async (incident: SafetyIncident) => {
    await supabase.from('safety_incidents').insert({
        therapist_id: incident.therapistId,
        client_name: incident.clientName,
        incident_type: incident.type,
        description: incident.description,
        time_of_incident: incident.timeOfIncident,
        status: 'Reported',
        created_at: new Date().toISOString()
    });
};

export const getCrisisTherapists = async (): Promise<Therapist[]> => {
    // Filter therapists where profile.is_crisis_certified = true
    const { data, error } = await supabase.from('users')
        .select(`id, display_name, therapist_profiles!inner(is_crisis_certified, specialty, experience)`)
        .eq('role', 'therapist')
        .eq('therapist_profiles.is_crisis_certified', true);

    if (error || !data) return [];

    return data.map((u: any) => ({
        id: u.id,
        name: u.display_name,
        email: '',
        specialty: u.therapist_profiles.specialty,
        experience: u.therapist_profiles.experience,
        languages: [],
        rating: 5,
        reviewCount: 0,
        bookingUrl: '',
        status: 'LIVE',
        bio: ''
    }));
};

export const createEmergencySession = async (alertId: string, clientId: string, therapistId: string) => {
    await supabase.from('emergency_sessions').insert({
        alert_id: alertId,
        client_id: clientId,
        therapist_id: therapistId,
        started_at: new Date().toISOString()
    });
    // Mark alert handled
    await supabase.from('risk_alerts').update({ status: 'Handling' }).eq('id', alertId);
};

// --- CALENDAR & APPOINTMENTS (Connected to: calendar_slots) ---

export const getTherapistSchedule = async (therapistId: string): Promise<CalendarSlot[]> => {
    const { data } = await supabase.from('calendar_slots')
        .select('*')
        .eq('therapist_id', therapistId)
        .gte('date', new Date().toISOString().split('T')[0]);
        
    return (data || []).map((s: any) => ({
        id: s.id,
        date: s.date,
        time: s.time,
        duration: s.duration,
        status: s.status,
        clientName: s.client_name,
        type: s.session_type
    }));
};

export const addCalendarSlot = async (slot: any) => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    
    await supabase.from('calendar_slots').insert({
        therapist_id: user.id,
        date: slot.date,
        time: slot.time,
        duration: slot.duration,
        status: 'available'
    });
};

export const deleteCalendarSlot = async (id: string) => {
    await supabase.from('calendar_slots').delete().eq('id', id);
};

// --- TEAM & ADMIN (Connected to: team_members, broadcasts) ---

export const getTeamMembers = async (): Promise<TeamMember[]> => {
    const { data } = await supabase.from('team_members').select('*');
    return (data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        status: m.status,
        is_active: m.status === 'Active',
        access_expires_at: m.access_expires_at,
        lastLogin: new Date(m.last_login || Date.now()).getTime(),
        addedAt: new Date(m.created_at).getTime(),
        permissions: m.permissions || {}
    }));
};

export const addTeamMember = async (member: TeamMember) => {
    await supabase.from('team_members').insert({
        name: member.name,
        email: member.email,
        role: member.role,
        status: member.status,
        permissions: member.permissions,
        access_expires_at: member.access_expires_at,
        created_at: new Date().toISOString()
    });
    await logAdminAction('add_team_member', { email: member.email, role: member.role });
};

export const revokeTeamAccess = async (id: string) => {
    await supabase.from('team_members').delete().eq('id', id);
    await logAdminAction('revoke_team_member', { id });
};

export const updateTeamMemberStatus = async (id: string, status: string) => {
    await supabase.from('team_members').update({ status }).eq('id', id);
};

export const sendBroadcast = async (title: string, message: string, type: string, audience: string) => {
    // 1. Insert into broadcasts table
    const broadcastId = 'broad-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const { error: broadcastError } = await supabase.from('broadcasts').insert({
        id: broadcastId,
        title, message, type, audience, sent_at: new Date().toISOString()
    });
    if (broadcastError) {
        console.error("Broadcast DB Insert Error:", broadcastError);
        return false;
    }

    try {
        // 2. Fetch users matching target audience filters
        let userQuery = supabase.from('users').select('id, role');
        if (audience === 'therapists') {
            userQuery = userQuery.eq('role', 'therapist');
        } else if (audience === 'clients') {
            userQuery = userQuery.eq('role', 'patient');
        }

        const { data: users } = await userQuery;
        if (users && users.length > 0) {
            // 3. Prepare list of notifications to insert
            const notificationsToInsert = users.map((user: any) => ({
                id: 'notif-' + Math.random().toString(36).substring(2) + Date.now().toString(36),
                user_id: user.id,
                title,
                message,
                type: 'system',
                is_read: 0,
                created_at: new Date().toISOString()
            }));
            
            await supabase.from('notifications').insert(notificationsToInsert);
        }
    } catch (e) {
        console.error("Failed to generate bulk blast notifications:", e);
    }

    return true;
};

export const getBroadcastHistory = async (): Promise<Broadcast[]> => {
    const { data } = await supabase.from('broadcasts').select('*').order('sent_at', { ascending: false });
    return (data || []).map((b: any) => ({
        id: b.id,
        title: b.title,
        message: b.message,
        type: b.type,
        audience: b.audience,
        sentAt: new Date(b.sent_at).getTime()
    }));
};

// --- MESSAGING & CONNECTIONS (Connected to: direct_messages, therapist_connections, therapy_notes) ---

export const getDirectMessages = async (otherUserId: string) => {
    const myId = (await supabase.auth.getUser()).data.user?.id;
    if (!myId) return [];

    const { data } = await supabase.from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: true });
        
    return data || [];
};

export const sendDirectMessage = async (receiverId: string, content: string) => {
    const myId = (await supabase.auth.getUser()).data.user?.id;
    if (!myId) return;

    await supabase.from('direct_messages').insert({
        sender_id: myId,
        receiver_id: receiverId,
        content,
        created_at: new Date().toISOString()
    });
};

export const getTherapistConnections = async (): Promise<TherapistConnection[]> => {
    try {
        // Joins to get names
        const { data, error } = await supabase.from('therapist_connections')
            .select(`
                id, status, created_at, meeting_link,
                client:users!client_id(id, display_name),
                therapist:users!therapist_id(id, display_name)
            `);
            
        if (error) {
            console.error("Error fetching connections from DB:", error);
            return [];
        }
            
        return (data || []).map((c: any) => ({
            id: c.id,
            therapistId: c.therapist?.id,
            therapistName: c.therapist?.display_name || 'N/A',
            clientId: c.client?.id,
            clientName: c.client?.display_name || 'N/A',
            status: c.status === 'active' ? 'ACTIVE' : 'ENDED',
            totalSessions: 0,
            lastMeeting: c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A',
            meetingLink: c.meeting_link
        }));
    } catch (e) {
        console.error("Failed to run getTherapistConnections:", e);
        return [];
    }
};

export const updateMeetingLink = async (connectionId: string, link: string) => {
    const { error } = await supabase.from('therapist_connections')
        .update({ meeting_link: link })
        .eq('id', connectionId);
    return !error;
};

export const getClientTherapist = async (clientId: string): Promise<TherapistConnection | null> => {
    const { data, error } = await supabase.from('therapist_connections')
        .select(`
            id, status, created_at, meeting_link,
            therapist:users!therapist_id(id, display_name)
        `)
        .eq('client_id', clientId)
        .eq('status', 'active')
        .maybeSingle();

    if (error || !data) return null;

    return {
        id: data.id,
        therapistId: data.therapist?.id,
        therapistName: data.therapist?.display_name,
        clientId: clientId,
        clientName: '', // Not needed here
        status: 'ACTIVE',
        totalSessions: 0,
        lastMeeting: new Date(data.created_at).toLocaleDateString(),
        meetingLink: data.meeting_link
    };
};

export const breakConnection = async (id: string) => {
    await supabase.from('therapist_connections').delete().eq('id', id);
    await logAdminAction('break_connection', { id });
};

export const assignTherapist = async (data: { clientId: string, therapistId: string, duration: number, frequency: string, reason?: string }) => {
    await supabase.from('therapist_connections').insert({
        client_id: data.clientId,
        therapist_id: data.therapistId,
        status: 'active',
        notes: data.reason,
        config: { duration: data.duration, frequency: data.frequency },
        created_at: new Date().toISOString()
    });
    await logAdminAction('assign_therapist', { client: data.clientId, therapist: data.therapistId });
    return true;
};

export const activateClientTherapistConnection = async (clientId: string, therapistId: string) => {
    const chatExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    // Use upsert or select then update/insert
    const { data: existing } = await supabase.from('therapist_connections')
        .select('id')
        .eq('client_id', clientId)
        .eq('therapist_id', therapistId)
        .single();
        
    if (existing) {
        await supabase.from('therapist_connections')
            .update({ status: 'active', chat_expires_at: chatExpiresAt })
            .eq('id', existing.id);
    } else {
        await supabase.from('therapist_connections').insert({
            id: crypto.randomUUID(),
            client_id: clientId,
            therapist_id: therapistId,
            status: 'active',
            chat_expires_at: chatExpiresAt,
            created_at: new Date().toISOString()
        });
    }
};

export const getTherapistPatients = async (therapistId: string): Promise<TherapistConnection[]> => {
    const { data } = await supabase.from('therapist_connections')
        .select(`
            id, status, created_at, meeting_link, chat_expires_at,
            client:users!client_id(id, display_name, email)
        `)
        .eq('therapist_id', therapistId)
        .eq('status', 'active');

    return (data || []).map((c: any) => ({
        id: c.id,
        therapistId: therapistId,
        therapistName: '', // Not needed here
        clientId: c.client?.id,
        clientName: c.client?.display_name,
        status: 'ACTIVE',
        totalSessions: 0,
        lastMeeting: new Date(c.created_at).toLocaleDateString(),
        meetingLink: c.meeting_link,
        chatExpiresAt: c.chat_expires_at
    }));
};

export const getClientConnection = async (clientId: string): Promise<TherapistConnection | null> => {
    const { data, error } = await supabase.from('therapist_connections')
        .select(`
            id, status, created_at, meeting_link, chat_expires_at,
            therapist:users!therapist_id(id, display_name)
        `)
        .eq('client_id', clientId)
        .eq('status', 'active')
        .single();
    
    if (error || !data) return null;
    return {
        id: data.id,
        therapistId: data.therapist?.id,
        therapistName: data.therapist?.display_name || 'Therapist',
        clientId: clientId,
        clientName: '', // Not needed here
        status: 'ACTIVE',
        totalSessions: 0,
        lastMeeting: new Date(data.created_at).toLocaleDateString(),
        meetingLink: data.meeting_link,
        chatExpiresAt: data.chat_expires_at
    };
};

export const getTherapyNotes = async (): Promise<TherapyNote[]> => {
    const { data } = await supabase.from('therapy_notes').select('*').order('created_at', { ascending: false });
    return (data || []).map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        therapistId: n.therapist_id,
        title: n.title,
        details: n.details,
        markType: n.mark_type,
        dateOfNote: n.date_of_note,
        createdAt: new Date(n.created_at).getTime(),
        nextReminder: n.next_reminder
    }));
};

export const saveTherapyNote = async (note: TherapyNote) => {
    await supabase.from('therapy_notes').insert({
        user_id: note.userId,
        therapist_id: note.therapistId,
        title: note.title,
        details: note.details,
        mark_type: note.markType,
        date_of_note: note.dateOfNote,
        next_reminder: note.nextReminder,
        created_at: new Date().toISOString()
    });
};


export const searchUsers = async (query: string, role: string) => {
    const { data } = await supabase.from('users')
        .select('id, display_name, email, role')
        .ilike('display_name', `%${query}%`)
        .eq('role', role === 'client' ? 'patient' : role)
        .limit(5);
        
    return (data || []).map((u: any) => ({ 
        id: u.id, 
        name: u.display_name || 'Unknown', 
        email: u.email || 'No Email' 
    }));
};

// --- DATA PERSISTENCE (Chat & Journal) ---

export const saveChatSession = async (userId: string, session: Session) => {
    if (!userId || userId === 'guest') return;
    const { error } = await supabase.from('chat_sessions').upsert({
        id: session.id,
        user_id: userId,
        created_at: new Date(session.startTime).toISOString(),
        updated_at: new Date(session.endTime).toISOString(),
        mood: session.moodStart || null
    });
    if (error) console.error("Error saving session to DB:", error.message);
    else {
        // Gamification: Reward points for Therapy Session
        const token = localStorage.getItem('sukoon_auth_token');
        fetch('/api/gamification/award', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
           body: JSON.stringify({ reason: "Completed Therapy Session", points: 20 })
        }).catch(e => console.error("Award err:", e));
    }
};

const cachedNotifications: Record<string, Notification[]> = {};

export const analyzeMoodPatterns = async (userId: string) => {
    if (!userId || userId === 'guest') return;
    
    try {
        console.log(`[Mood Analysis] Running for userId=${userId}`);
        
        // 1. Fetch recent notifications to prevent spam (no duplicates in past 30 minutes)
        const { data: recentNotifs } = await supabase.from('notifications')
            .select('*')
            .eq('user_id', userId)
            .eq('title', 'Mood Support Check-in')
            .order('created_at', { ascending: false });
            
        if (recentNotifs && recentNotifs.length > 0) {
            const lastTime = new Date(recentNotifs[0].created_at).getTime();
            const now = Date.now();
            if (now - lastTime < 30 * 60 * 1000) { // 30 minutes
                console.log(`[Mood Analysis] Recently notified user ${userId} at ${recentNotifs[0].created_at}, skipping.`);
                return;
            }
        }

        let negativePoints = 0;
        let reasons: string[] = [];

        // 2. Fetch recent journal entries
        const { data: journals } = await supabase.from('journal_entries')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        const negativeMoods = ['Sad', 'Anxious', 'Stressed', 'Angry', 'Frustrated', 'Overwhelmed', 'Depressed'];
        const negativeKeywords = ['sad', 'anxious', 'stress', 'strest', 'overwhelm', 'depress', 'hopeless', 'lonely', 'tired', 'help', 'panic', 'pain', 'cry', 'scared', 'fear', 'hurt'];

        if (journals && journals.length > 0) {
            journals.forEach((j: any) => {
                if (j.mood && negativeMoods.includes((j.mood as string).trim())) {
                    negativePoints += 2;
                    reasons.push(`Journal Mood: ${j.mood}`);
                } else if (j.content) {
                    const contentLower = j.content.toLowerCase();
                    const matched = negativeKeywords.filter(kw => contentLower.includes(kw));
                    if (matched.length > 0) {
                        negativePoints += matched.length >= 2 ? 2 : 1;
                        reasons.push(`Journal text keyword matched: [${matched.join(', ')}]`);
                    }
                }
            });
        }

        // 3. Fetch recent chat messages (where role is user)
        const { data: messages } = await supabase.from('chat_messages')
            .select('*')
            .eq('user_id', userId)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(10);

        if (messages && messages.length > 0) {
            messages.forEach((m: any) => {
                if (m.content) {
                    const contentLower = m.content.toLowerCase();
                    const matched = negativeKeywords.filter(kw => contentLower.includes(kw));
                    if (matched.length > 0) {
                        negativePoints += matched.length >= 2 ? 2 : 1;
                        reasons.push(`Chat text keyword matched: [${matched.join(', ')}]`);
                    }
                }
            });
        }

        // 4. Fetch recent check-ins
        const { data: checkins } = await supabase.from('check_in_events')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (checkins && checkins.length > 0) {
            checkins.forEach((c: any) => {
                const respLower = (c.response || '').toLowerCase();
                const matched = negativeKeywords.filter(kw => respLower.includes(kw));
                if (matched.length > 0) {
                    negativePoints += 1;
                    reasons.push(`Check-in response keyword matched: [${matched.join(', ')}]`);
                }
            });
        }

        console.log(`[Mood Analysis] User ${userId} negative points: ${negativePoints}, reasons:`, reasons);

        if (negativePoints >= 3) {
            const msgId = `n-mood-${Date.now()}`;
            delete cachedNotifications[userId];
            await supabase.from('notifications').insert({
                id: msgId,
                user_id: userId,
                title: 'Mood Support Check-in',
                message: 'We noticed a persistent pattern of stress, anxiety, or sadness in your recent journals, check-ins, or conversations. Remember, Sukoon is here to support you. You can connect with professional therapists or explore our meditation paths.',
                type: 'warning',
                is_read: false,
                created_at: new Date().toISOString()
            });
            console.log(`[Mood Analysis] Generated notification ${msgId} for user ${userId}`);
        }
    } catch (e) {
        console.error("[Mood Analysis] Error evaluating mood patterns:", e);
    }
};

export const saveChatMessage = async (userId: string, sessionId: string, message: Message) => {
    if (!userId || userId === 'guest') return;
    const safeContent = typeof message.text === 'string' ? message.text : JSON.stringify(message.text || "");
    const { error } = await supabase.from('chat_messages').insert({
        id: message.id,
        session_id: sessionId,
        user_id: userId,
        role: message.role,
        content: safeContent,
        created_at: new Date(message.timestamp).toISOString(),
        metadata: {
            grounding_links: message.groundingLinks || [],
            has_audio: !!message.audioBase64
        }
    });
    if (error) {
        console.error("Error saving message to DB:", error.message);
    } else {
        analyzeMoodPatterns(userId).catch(console.error);
        if (message.role === 'user') {
            const riskLevel = classifyMessageRisk(safeContent);
            if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
                try {
                    const { data: userProfile } = await supabase.from('users').select('display_name').eq('id', userId).single();
                    await triggerRiskAlert({
                        userId: userId,
                        userName: userProfile?.display_name || 'Anonymous User',
                        triggerKeyword: riskLevel,
                        message: safeContent
                    });
                } catch (e) {
                    console.error("Failed to trigger high risk alert:", e);
                }
            }
        }
    }
};

export const saveJournalEntry = async (userId: string, entry: JournalEntry) => {
    if (!userId || userId === 'guest') return;
    const safeContent = entry.content || "";
    const { error } = await supabase.from('journal_entries').insert({
        id: entry.id,
        user_id: userId,
        content: safeContent,
        title: entry.title,
        mood: entry.mood,
        created_at: new Date(entry.timestamp).toISOString()
    });
    if (error) console.error("Error saving journal to DB:", error.message);
    else {
        analyzeMoodPatterns(userId).catch(console.error);

        const riskLevel = classifyMessageRisk(safeContent);
        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
            try {
                const { data: userProfile } = await supabase.from('users').select('display_name').eq('id', userId).single();
                await triggerRiskAlert({
                    userId: userId,
                    userName: userProfile?.display_name || 'Anonymous User',
                    triggerKeyword: riskLevel,
                    message: `Journal [${entry.title}]: ${safeContent}`
                });
            } catch (e) {
                console.error("Failed to trigger journal high risk alert:", e);
            }
        }
        
        // Gamification: Reward points for Journal Entry and Mood Tracking
        const token = localStorage.getItem('sukoon_auth_token');
        fetch('/api/gamification/award', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
           body: JSON.stringify({ reason: "Wrote Journal Entry", points: 10 })
        }).catch(e => console.error("Award err:", e));
        
        if (entry.mood) {
             fetch('/api/gamification/award', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
               body: JSON.stringify({ reason: "Tracked Mood", points: 5 })
            }).catch(e => console.error("Award err:", e));
        }
    }
};

export const deleteJournalEntry = async (entryId: string): Promise<boolean> => {
    const { error } = await supabase.from('journal_entries').delete().eq('id', entryId);
    if (error) {
        console.error("Error deleting journal from DB:", error.message);
        return false;
    }
    return true;
};

export const saveCheckInEvent = async (event: any) => {
    const user = (await supabase.auth.getUser()).data.user;
    await supabase.from('check_in_events').insert({
        user_id: user?.id || 'anon',
        question_id: event.questionId,
        response: event.response,
        created_at: new Date(event.timestamp).toISOString()
    });
    if (user && user.id) {
        analyzeMoodPatterns(user.id).catch(console.error);
        
        const token = localStorage.getItem('sukoon_auth_token');
        fetch('/api/gamification/award', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
           body: JSON.stringify({ reason: "Daily Check-in", points: 5 })
         }).catch(e => console.error(e));
    }
};

export const saveTherapistApplication = async (app: TherapistApplication) => {
    await supabase.from('therapist_applications').insert({
        id: app.id,
        user_id: app.userId,
        full_name: app.fullName,
        email: app.email,
        phone: app.phone,
        years_experience: app.yearsExperience,
        specialization: app.specialization,
        license_number: app.licenseNumber,
        cv_file: app.cvFileName,
        degree_file: app.degreeFileName,
        status: app.status,
        submitted_at: new Date(app.submittedAt).toISOString()
    });
};

export const suspendUser = async (userId: string, reason: string) => {
    const { error } = await supabase.from('users').update({ 
        account_status: 'suspended', 
        suspension_reason: reason 
    }).eq('id', userId);
    
    if (error) {
        console.error("Failed to suspend user:", error);
        throw error;
    }
};

// --- MISC EXPORTS / PLACEHOLDERS (To maintain TS interface) ---
export const getActiveBroadcasts = async (settings: UserSettings): Promise<Broadcast[]> => getBroadcastHistory();
export const getUserNotifications = async (): Promise<Notification[]> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return [];
    
    // Evaluate mood patterns dynamically on-the-fly
    await analyzeMoodPatterns(user.id).catch(console.error);
    
    if (cachedNotifications[user.id]) {
        console.log(`[Cache Hit] getUserNotifications for userId=${user.id}`);
        return cachedNotifications[user.id];
    }
    
    const { data } = await supabase.from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
    const mapped = (data || []).map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        message: n.message,
        title: n.title,
        type: n.type,
        isRead: n.is_read,
        createdAt: new Date(n.created_at).getTime()
    }));
    cachedNotifications[user.id] = mapped;
    return mapped;
};

export const createNotification = async (userId: string, title: string, message: string, type: 'meeting' | 'chat' | 'system' | 'alert' = 'system') => {
    delete cachedNotifications[userId];
    await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type,
        is_read: false
    });
};

export const markAllNotificationsRead = async (userId: string) => {
    if (cachedNotifications[userId]) {
        cachedNotifications[userId] = cachedNotifications[userId].map(n => ({ ...n, isRead: true }));
    }
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
};

export const markNotificationRead = async (id: string) => {
    for (const userId of Object.keys(cachedNotifications)) {
        cachedNotifications[userId] = cachedNotifications[userId].map(n => n.id === id ? { ...n, isRead: true } : n);
    }
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
};
export const checkPendingInterventions = (userId: string): any[] => [];
export const scanForPII = (text: string) => {
    const phoneRegex = /(\+92|0)?3[0-9]{2}-?[0-9]{7}/;
    if (phoneRegex.test(text)) return { detected: true, type: 'Phone Number', match: text.match(phoneRegex)?.[0] };
    return { detected: false };
};
export const getAdminStats = async (): Promise<AdminStats> => {
    try {
        const [usersRes, therapistsRes, sessionsRes, creditsRes] = await Promise.all([
            supabase.from('users').select('id', { count: 'exact', head: true }),
            supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'therapist').eq('account_status', 'active'),
            supabase.from('chat_sessions').select('id', { count: 'exact', head: true }),
            supabase.from('wallet_transactions').select('amount').eq('type', 'Credit').eq('status', 'Verified')
        ]);

        const totalUsers = usersRes?.count || 0;
        const activeTherapists = therapistsRes?.count || 0;
        const totalSessions = sessionsRes?.count || 0;
        const credits = creditsRes?.data || [];
        const totalRevenue = credits.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

        // Active users today (users who had a session today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let activeToday = 0;
        try {
            const { count } = await supabase.from('chat_sessions')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString());
            activeToday = count || 0;
        } catch (sessionErr) {
            console.warn("Could not retrieve active sessions count for today:", sessionErr);
        }

        return {
            totalUsers,
            activeUsersToday: activeToday,
            totalSessions,
            activeTherapists,
            totalRevenue
        };
    } catch (e) {
        console.error("Failed to fetch getAdminStats:", e);
        return {
            totalUsers: 0,
            activeUsersToday: 0,
            totalSessions: 0,
            activeTherapists: 0,
            totalRevenue: 0
        };
    }
};
export const deleteTherapist = async (id: string) => {};
export const getAdminAlerts = async (): Promise<AdminAlert[]> => {
    try {
        const { data, error } = await supabase.from('risk_alerts').select('*').order('detected_at', { ascending: false });
        if (error) {
            console.error("Error retrieving admin risk alerts from DB:", error);
            return [];
        }
        return (data || []).map((a: any) => ({
            id: a.id,
            type: a.type || 'Risk Alert',
            message: a.message,
            timestamp: a.detected_at ? new Date(a.detected_at).getTime() : Date.now(),
            status: a.status,
            userId: a.user_id,
            userName: a.client_name
        }));
    } catch (e) {
        console.error("Failed to run getAdminAlerts:", e);
        return [];
    }
};
export const resolveAlert = async (id: string) => {
    const { error } = await supabase.from('risk_alerts').update({ status: 'Resolved' }).eq('id', id);
    if (error) console.error("Error resolving alert:", error.message);
};
export const getInvestments = async (): Promise<Investment[]> => [];
export const addInvestment = async () => {};
export const deleteInvestment = async () => {};
export const updateInvestment = async () => {};
export const addTransaction = async () => {};
export const deleteTransaction = async () => {};
export const getChatThreads = async (): Promise<ChatThread[]> => [];
export const getSystemHealth = async (): Promise<SystemHealth> => {
    const start = Date.now();
    try {
        const { error } = await supabase.from('users').select('id', { count: 'exact', head: true }).limit(1);
        const latency = Date.now() - start;
        
        return {
            status: error ? 'Degraded' : 'Healthy',
            apiErrors: error ? 1 : 0,
            latency: latency,
            database: error ? 'Offline' : 'Online'
        };
    } catch (e) {
        console.error("Failed to perform getSystemHealth test:", e);
        return {
            status: 'Degraded',
            apiErrors: 1,
            latency: Date.now() - start,
            database: 'Offline'
        };
    }
};
export const getMonetizationSettings = async (): Promise<MonetizationConfig> => {
    const { data, error } = await supabase.from('system_settings').select('value').eq('key', 'monetization').single();
    if (error || !data) return { commissionRate: 20, payoutCycleDays: 29 };
    return data.value as MonetizationConfig;
};
export const updateMonetizationSettings = async () => {};
export const sendSystemBlast = async () => {};
export const getSystemNotifications = async (): Promise<SystemNotification[]> => [];
export const getRecommendedTherapists = async () => {};
export const sendIntervention = async () => {};
export const getCompanyExpenses = async (): Promise<CompanyExpense[]> => [];
export const addCompanyExpense = async () => {};
export const recordManualPayout = async () => {};

// --- BOOKINGS, BOOSTS, AND SUBSCRIPTIONS ---

let cachedBookings: Record<string, any[]> = {};

export const clearBookingsCache = () => {
    cachedBookings = {};
};

export const createSessionBooking = async (booking: any): Promise<any> => {
    cachedBookings = {};
    const { data, error } = await supabase.from('session_bookings').insert(booking);
    if (error) {
        console.error("Error creating session booking", error.message);
        throw error;
    }
    
    // Attempt to block the calendar slot immediately to prevent double booking
    if (booking.therapist_id && booking.date && booking.time_slot) {
        await supabase.from('calendar_slots')
            .update({ status: 'pending', client_name: 'Pending Audit' })
            .eq('therapist_id', booking.therapist_id)
            .eq('date', booking.date)
            .eq('time', booking.time_slot)
            .eq('status', 'available');
    }
    
    return data;
};

export const updateSessionBooking = async (id: string, updates: any): Promise<any> => {
    cachedBookings = {};
    const { data, error } = await supabase.from('session_bookings').update(updates).eq('id', id).select('*').single();
    if (error) {
        console.error("Error updating session booking", error.message);
        throw error;
    }
    
    if (data && updates.status === 'Session Confirmed') {
        const clientReq = await supabase.from('users').select('display_name').eq('id', data.client_id).single();
        const clientName = clientReq.data?.display_name || 'Client';
        
        await supabase.from('calendar_slots')
            .update({ status: 'booked', client_name: clientName, session_type: data.session_type })
            .eq('therapist_id', data.therapist_id)
            .eq('date', data.date)
            .eq('time', data.time_slot);
    }
    
    if (data && updates.status === 'Payment Rejected') {
        await supabase.from('calendar_slots')
            .update({ status: 'available', client_name: null, session_type: null })
            .eq('therapist_id', data.therapist_id)
            .eq('date', data.date)
            .eq('time', data.time_slot)
            .eq('status', 'pending');
    }

    return data;
};

export const getSessionBookings = async (filters: { clientId?: string, therapistId?: string }): Promise<any[]> => {
    const cacheKey = JSON.stringify(filters);
    if (cachedBookings[cacheKey]) {
        console.log(`[Cache Hit] getSessionBookings key=${cacheKey}`);
        return cachedBookings[cacheKey];
    }
    let query = supabase.from('session_bookings').select('*');
    if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
    }
    if (filters.therapistId) {
        query = query.eq('therapist_id', filters.therapistId);
    }
    const { data, error } = await query;
    if (error) {
        console.error("Error fetching session bookings", error.message);
        return [];
    }
    const mapped = (data || []).map((b: any) => ({
        id: b.id,
        clientId: b.client_id,
        therapistId: b.therapist_id,
        sessionType: b.session_type,
        date: b.date,
        timeSlot: b.time_slot,
        duration: b.duration,
        fee: b.fee,
        status: b.status,
        paymentScreenshot: b.payment_screenshot,
        transactionId: b.transaction_id,
        notes: b.notes,
        createdAt: b.created_at,
        updatedAt: b.updated_at
    }));
    cachedBookings[cacheKey] = mapped;
    return mapped;
};

export const getAllSessionBookingsForAdmin = async (): Promise<any[]> => {
    const { data, error } = await supabase.from('session_bookings').select('*');
    if (error) {
        console.error("Error fetching session bookings for admin", error.message);
        return [];
    }
    return (data || []).map((b: any) => ({
        id: b.id,
        clientId: b.client_id,
        therapistId: b.therapist_id,
        sessionType: b.session_type,
        date: b.date,
        timeSlot: b.time_slot,
        duration: b.duration,
        fee: b.fee,
        status: b.status,
        paymentScreenshot: b.payment_screenshot,
        transactionId: b.transaction_id,
        notes: b.notes,
        createdAt: b.created_at,
        updatedAt: b.updated_at
    }));
};

// Therapist Boosts
export const createTherapistBoost = async (boost: any): Promise<any> => {
    const { data, error } = await supabase.from('therapist_boosts').insert(boost);
    if (error) {
        console.error("Error creating therapist boost", error.message);
        throw error;
    }
    return data;
};

export const updateTherapistBoost = async (id: string, updates: any): Promise<any> => {
    const { data, error } = await supabase.from('therapist_boosts').update(updates).eq('id', id);
    if (error) {
        console.error("Error updating therapist boost", error.message);
        throw error;
    }
    return data;
};

export const getTherapistBoosts = async (therapistId?: string): Promise<any[]> => {
    let query = supabase.from('therapist_boosts').select('*');
    if (therapistId) {
        query = query.eq('therapist_id', therapistId);
    }
    const { data, error } = await query;
    if (error) {
        console.error("Error fetching therapist boosts", error.message);
        return [];
    }
    return (data || []).map((b: any) => ({
        id: b.id,
        therapistId: b.therapist_id,
        packageType: b.package_type,
        durationDays: b.duration_days,
        cost: b.cost,
        status: b.status,
        paymentScreenshot: b.payment_screenshot,
        createdAt: b.created_at,
        expiresAt: b.expires_at
    }));
};

export const adminQuery = async (table: string, filters: any[] = []) => {
    const response = await fetch('/api/db/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, filters })
    });
    
    if (!response.ok) {
        let errorMessage = 'API request failed';
        try {
            const errorResult = await response.json();
            errorMessage = errorResult.error?.message || errorMessage;
        } catch (e) {
            errorMessage = await response.text();
        }
        throw new Error(errorMessage);
    }
    
    const result = await response.json();
    if (result.error) {
        throw new Error(result.error.message || result.error);
    }
    return result.data;
};

export const getAllTherapistBoostsForAdmin = async (): Promise<any[]> => {
    try {
        const data = await adminQuery('therapist_boosts');
        return (data || []).map((b: any) => ({
            id: b.id,
            therapistId: b.therapist_id,
            packageType: b.package_type,
            durationDays: b.duration_days,
            cost: b.cost,
            status: b.status,
            paymentScreenshot: b.payment_screenshot,
            createdAt: b.created_at,
            expiresAt: b.expires_at
        }));
    } catch (e) {
        console.error("Error fetching boosts admin", e);
        return [];
    }
};

// Therapist Pro Subscriptions
export const createTherapistSubscription = async (sub: any): Promise<any> => {
    const { data, error } = await supabase.from('therapist_subscriptions').insert(sub);
    if (error) {
        console.error("Error creating therapist sub", error.message);
        throw error;
    }
    return data;
};

export const updateTherapistSubscription = async (id: string, updates: any): Promise<any> => {
    const { data, error } = await supabase.from('therapist_subscriptions').update(updates).eq('id', id);
    if (error) {
        console.error("Error updating therapist subscription", error.message);
        throw error;
    }
    return data;
};

export const getTherapistSubscriptions = async (therapistId?: string): Promise<any[]> => {
    let query = supabase.from('therapist_subscriptions').select('*');
    if (therapistId) {
        query = query.eq('therapist_id', therapistId);
    }
    const { data, error } = await query;
    if (error) {
        console.error("Error fetching therapist subscriptions", error.message);
        return [];
    }
    return (data || []).map((s: any) => ({
        id: s.id,
        therapistId: s.therapist_id,
        planType: s.plan_type,
        cost: s.cost,
        status: s.status,
        paymentScreenshot: s.payment_screenshot,
        createdAt: s.created_at,
        expiresAt: s.expires_at
    }));
};

export const getAllTherapistSubscriptionsForAdmin = async (): Promise<any[]> => {
    try {
        const data = await adminQuery('therapist_subscriptions');
        return (data || []).map((s: any) => ({
            id: s.id,
            therapistId: s.therapist_id,
            planType: s.plan_type,
            cost: s.cost,
            status: s.status,
            paymentScreenshot: s.payment_screenshot,
            createdAt: s.created_at,
            expiresAt: s.expires_at
        }));
    } catch (e) {
        console.error("Error fetching subscriptions admin", e);
        return [];
    }
};

// --- FOLLOW-UP MESSAGING (New) ---

const apiRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
    const response = await fetch(endpoint, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('sukoon_auth_token') || ''}`
        },
        body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
        let errorMessage = 'API request failed';
        try {
            const errorResult = await response.json();
            errorMessage = errorResult.detail || errorResult.error || errorMessage;
        } catch (e) {
            errorMessage = await response.text();
        }
        throw new Error(errorMessage);
    }
    return await response.json();
};

export const getTherapistPreviousPatients = async (therapistId: string): Promise<TherapistConnection[]> => {
    const { data } = await supabase.from('therapist_connections')
        .select(`
            id, status, created_at, meeting_link, chat_expires_at,
            client:users!client_id(id, display_name, email)
        `)
        .eq('therapist_id', therapistId)
        .neq('status', 'active');

    return (data || []).map((c: any) => ({
        id: c.id,
        therapistId: therapistId,
        therapistName: '', 
        clientId: c.client?.id,
        clientName: c.client?.display_name,
        status: 'INACTIVE',
        totalSessions: 1,
        lastMeeting: new Date(c.created_at).toLocaleDateString(),
        meetingLink: c.meeting_link,
        chatExpiresAt: c.chat_expires_at
    }));
};

export const getFollowupForBooking = async (bookingId: string) => {
    const { data, error } = await supabase.from('followup_conversations').select('*').eq('booking_id', bookingId).single();
    if (error && error.code !== 'PGRST116') console.error("Error fetching followup", error);
    return data;
};

export const createFollowupForBooking = async (therapistId: string, patientId: string, bookingId: string) => {
    const { data, error } = await supabase.from('followup_conversations').insert({
        id: crypto.randomUUID(),
        therapist_id: therapistId,
        patient_id: patientId,
        booking_id: bookingId,
        message_count: 0,
        followup_expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        last_message_at: new Date().toISOString()
    });
    if (error) console.error("Error creating followup", error);
    return data;
};

export const incrementFollowupMessage = async (id: string, count: number) => {
    await supabase.from('followup_conversations').update({
        message_count: count + 1,
        last_message_at: new Date().toISOString()
    }).eq('id', id);
};

export const sendFollowupRequest = async (patientId: string) => {
    return apiRequest('/api/therapists/followup/request/send', 'POST', { patient_id: patientId });
};

export const decideFollowupRequest = async (requestId: string, action: 'accept' | 'decline') => {
    return apiRequest('/api/therapists/followup/request/decide', 'POST', { request_id: requestId, action });
};

export const configurePaidChat = async (price1d: number, price7d: number, price1m: number) => {
    return apiRequest('/api/therapists/paid-chat/configure', 'POST', { price_1d: price1d, price_7d: price7d, price_1m: price1m });
};

export const purchasePaidChat = async (therapistId: string, durationType: '1d' | '7d' | '1m') => {
    return apiRequest('/api/therapists/paid-chat/purchase', 'POST', { therapist_id: therapistId, duration_type: durationType });
};

export const getSlaReports = async () => {
    return apiRequest('/api/therapists/admin/sla-reports', 'GET');
};

export const resolveSlaViolation = async (violationId: string, action: 'refunded' | 'dismissed') => {
    return apiRequest('/api/therapists/admin/sla-viol/resolve', 'POST', { violation_id: violationId, action });
};

// --- RISK ASSIGNMENT & FOLLOW-UP MANAGEMENT SYSTEM ---

export const getAllTherapists = async (): Promise<any[]> => {
    try {
        const { data } = await supabase.from('users')
            .select(`id, display_name, email, therapist_profiles(specialty, experience, is_crisis_certified)`)
            .eq('role', 'therapist');
        return (data || []).map((u: any) => ({
            id: u.id,
            name: u.display_name || 'Anonymous Therapist',
            email: u.email,
            specialty: u.therapist_profiles?.specialty || 'General Therapy',
            experience: u.therapist_profiles?.experience || 0,
            isCrisisCertified: !!u.therapist_profiles?.is_crisis_certified
        }));
    } catch (e) {
        console.error("Error fetching all therapists:", e);
        return [];
    }
};

export const getTherapistAssignedAlerts = async (therapistId: string): Promise<RiskAlert[]> => {
    try {
        const { data } = await supabase.from('risk_alerts')
            .select('*')
            .eq('assigned_therapist_id', therapistId)
            .order('detected_at', { ascending: false });
        return (data || []).map((a: any) => ({
            id: a.id,
            clientId: a.user_id,
            clientName: a.client_name,
            triggerKeyword: a.trigger_keyword,
            detectedAt: new Date(a.detected_at).getTime(),
            status: a.status,
            message: a.message,
            assignedTherapistId: a.assigned_therapist_id,
            assignmentStatus: a.assignment_status,
            assignedAt: a.assigned_at,
            responseDeadline: a.response_deadline,
            followupStatus: a.followup_status
        }));
    } catch (e) {
        console.error("Error fetching therapist assigned alerts:", e);
        return [];
    }
};

export const assignTherapistToAlert = async (alertId: string, therapistId: string) => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours SLA
    const { error } = await supabase.from('risk_alerts').update({
        assigned_therapist_id: therapistId,
        assignment_status: 'pending',
        assigned_at: now.toISOString(),
        response_deadline: deadline.toISOString(),
        status: 'Handling'
    }).eq('id', alertId);

    if (error) throw error;

    // Send notification to therapist
    await createNotification(
        therapistId,
        '🚨 Urgent: High-Risk Case Assignment',
        'An admin has assigned you a critical risk case. Please respond within 2 hours.',
        'alert'
    );
};

export const respondToRiskAssignment = async (alertId: string, therapistId: string, action: 'accept' | 'reject') => {
    const status = action === 'accept' ? 'accepted' : 'rejected';
    
    // Fetch alert details
    const { data: alerts } = await supabase.from('risk_alerts').select('*').eq('id', alertId);
    if (!alerts || alerts.length === 0) throw new Error('Alert not found');
    const alert = alerts[0];

    // If accepted, followup status starts as 'active'. If rejected, it gets set back to none, therapist is cleared, and status is Active again.
    const { error } = await supabase.from('risk_alerts').update({
        assignment_status: status,
        followup_status: action === 'accept' ? 'active' : null,
        status: action === 'accept' ? 'Handling' : 'Active',
        assigned_therapist_id: action === 'reject' ? null : therapistId
    }).eq('id', alertId);

    if (error) throw error;

    // Send notifications to client
    const clientMsg = action === 'accept' 
        ? `A certified therapist has accepted translation support and has been assigned to support you. They will reach out shortly.`
        : `Your crisis intervention is undergoing administrative reallocation.`;
    await createNotification(alert.user_id, 'Therapist Assigned', clientMsg, 'alert');

    // Notify all admins
    const { data: admins } = await supabase.from('users').select('id').eq('is_admin', 1);
    const adminMsg = `Therapist has ${status} the high-risk assignment for client ${alert.client_name}.`;
    for (const admin of (admins || [])) {
        await createNotification(admin.id, `Case ${action === 'accept' ? 'Accepted' : 'Rejected'}`, adminMsg, 'alert');
    }
};

export const checkAndEscalateUnresponsiveAssignments = async () => {
    try {
        const { data } = await supabase.from('risk_alerts')
            .select('*')
            .eq('assignment_status', 'pending');
        
        const overdue = (data || []).filter((a: any) => a.response_deadline && new Date(a.response_deadline) < new Date());
        
        for (const alert of overdue) {
            await supabase.from('risk_alerts').update({
                assigned_therapist_id: null,
                assignment_status: 'none',
                status: 'Active',
                followup_status: 'escalated'
            }).eq('id', alert.id);

            // Notify admins
            const { data: admins } = await supabase.from('users').select('id').eq('is_admin', 1);
            const adminMsg = `Urgent: Therapist failed to accept high-risk case for ${alert.client_name} within the 2-hour deadline. The case has been returned to the admin queue.`;
            for (const admin of (admins || [])) {
                await createNotification(admin.id, '🚨 Escalation: SLA Breach', adminMsg, 'alert');
            }
        }
        return overdue.length;
    } catch (e) {
        console.error("Error executing responsive checks:", e);
        return 0;
    }
};

export const resolveRiskAlert = async (alertId: string) => {
    const { error } = await supabase.from('risk_alerts').update({
        status: 'Resolved',
        followup_status: 'completed'
    }).eq('id', alertId);
    if (error) throw error;
};


