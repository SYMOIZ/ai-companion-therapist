import React, { useState, useEffect } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { 
  getFinanceStats, 
  getRevenueTrend,
  getMarketingExpenses, 
  addMarketingExpense, 
  getPayoutRequests, 
  processPayout,
  getAllSessionBookingsForAdmin,
  updateSessionBooking,
  getAllTherapistBoostsForAdmin,
  updateTherapistBoost,
  getAllTherapistSubscriptionsForAdmin,
  updateTherapistSubscription,
  createNotification,
  getTherapists,
  activateClientTherapistConnection,
  unlockTherapistBankDetails
} from '../../services/dataService';
import { FinanceStats, MarketingExpense, PayoutRequest, Therapist } from '../../types';
import { 
  ShieldCheck, 
  Eye, 
  Check, 
  X, 
  Calendar, 
  TrendingUp, 
  Sparkles, 
  FileText, 
  Info, 
  Smartphone, 
  Clock, 
  UserPlus 
} from 'lucide-react';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ... (other imports)

// Optimized Revenue Chart Component
const RevenueChart = ({ data }: { data: any[] }) => {
    if (!data || data.length === 0) {
        return (
            <div className="h-64 w-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl text-sm text-slate-400">
                Monthly revenue trend data not yet available
            </div>
        );
    }
    
    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// --- Payout Modal Component ---
interface PayoutQueueModalProps {
    onClose: () => void;
}

const PayoutQueueModal: React.FC<PayoutQueueModalProps> = ({ onClose }) => {
    const [requests, setRequests] = useState<PayoutRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'All' | 'Pending' | 'Processed' | 'Rejected'>('Pending');

    useEffect(() => {
        loadPayouts();
    }, []);

    const loadPayouts = async () => {
        setLoading(true);
        const data = await getPayoutRequests();
        setRequests(data);
        setLoading(false);
    };

    const handleAction = async (id: string, action: 'Processed' | 'Rejected') => {
        if (confirm(`Mark this payout request as ${action === 'Processed' ? 'Completed' : 'Rejected'}?`)) {
            try {
                await processPayout(id, action);
                alert(`Payout request processed successfully with status: ${action === 'Processed' ? 'Completed' : 'Rejected'}.`);
                loadPayouts();
            } catch (err: any) {
                alert("Error processing payout: " + err.message);
            }
        }
    };

    const filteredRequests = requests.filter(r => filter === 'All' || r.status === filter);

    const formatCurrency = (amount: number) => 
        new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
            <div className="bg-white dark:bg-navy-800 w-full max-w-xl h-full flex flex-col shadow-2xl relative">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-navy-700 flex justify-between items-center bg-slate-50 dark:bg-navy-950">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Payout Inbound Queue</h2>
                        <p className="text-xs text-slate-500 mt-1">Settle platform obligations. Transact manually, then mark approved.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg text-slate-400 font-bold text-xl">
                        ×
                    </button>
                </div>

                {/* Submenu filters */}
                <div className="p-4 border-b border-slate-100 dark:border-navy-700 flex gap-2">
                    {['All', 'Pending', 'Processed', 'Rejected'].map(opt => (
                        <button
                            key={opt}
                            onClick={() => setFilter(opt as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter === opt ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400'}`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-navy-900 p-6">
                    {loading ? (
                        <div className="space-y-4 p-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="text-center text-slate-400 py-20 flex flex-col items-center">
                            <div className="text-4xl mb-2">💸</div>
                            <p>No {filter.toLowerCase()} payout requests found.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredRequests.map(req => (
                                <div key={req.id} className="bg-white dark:bg-navy-800 p-4 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-10 h-10 bg-slate-100 dark:bg-navy-700 rounded-full flex items-center justify-center font-bold text-slate-500 text-xs">
                                            {req.therapistName?.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 dark:text-white">{req.therapistName}</div>
                                            <div className="text-xs text-slate-500 font-mono">{req.therapistId} • {new Date(req.requestDate).toLocaleDateString()}</div>
                                            <div className="text-[10px] text-teal-600 mt-1 font-medium bg-teal-50 dark:bg-navy-950 px-2 py-0.5 rounded w-fit">{req.method}</div>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(req.amount)}</div>
                                        <div className={`text-[10px] font-bold uppercase ${req.status === 'Pending' ? 'text-amber-500' : req.status === 'Processed' ? 'text-teal-500' : 'text-rose-500'}`}>
                                            {req.status}
                                        </div>
                                    </div>

                                    {req.status === 'Pending' && (
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleAction(req.id, 'Rejected')}
                                                className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors" >
                                                Reject
                                            </button>
                                            <button 
                                                onClick={async () => {
                                                    const reason = prompt("What information is required?");
                                                    if (reason) {
                                                        if (confirm('Return payout to therapist and request more information?')) {
                                                            try {
                                                                await processPayout(req.id, 'Rejected', reason);
                                                                alert('Payout request returned to therapist with request for information.');
                                                                loadPayouts();
                                                            } catch (err: any) {
                                                                alert('Error processing request: ' + err.message);
                                                            }
                                                        }
                                                    }
                                                }}
                                                className="px-3 py-2 border border-amber-200 text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-bold transition-colors" >
                                                Need Info
                                            </button>
                                            <button 
                                                onClick={() => handleAction(req.id, 'Processed')}
                                                className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 rounded-lg text-xs font-bold shadow-md transition-colors" >
                                                Approve Transfer
                                            </button>
                                        </div>
                                    )}
                                    {req.status !== 'Pending' && (
                                        <div className="text-xs text-slate-400 italic px-4">
                                            {req.status === 'Processed' ? 'Transfer Complete' : 'Request Returned'}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const FinanceDashboard: React.FC = () => {
    const [stats, setStats] = useState<FinanceStats | null>(null);
    const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<MarketingExpense[]>([]);
    const [newExpense, setNewExpense] = useState({ platform: 'Facebook', amount: '', description: '' });
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPayoutModal, setShowPayoutModal] = useState(false);

    // Dynamic Lists for Audits flow
    const [therapists, setTherapists] = useState<Therapist[]>([]);
    const [sessionBookings, setSessionBookings] = useState<any[]>([]);
    const [boostRequests, setBoostRequests] = useState<any[]>([]);
    const [subRequests, setSubRequests] = useState<any[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditTab, setAuditTab] = useState<'bookings' | 'boosts' | 'subs' | 'accounts'>('bookings');
    
    // Receipt Modal Zoom State
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    // Rejection input state
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        refresh();
        loadAuditBoard();
    }, []);

    const refresh = async () => {
        const [s, e, t] = await Promise.all([getFinanceStats(), getMarketingExpenses(), getRevenueTrend()]);
        setStats(s);
        setExpenses(e);
        setRevenueTrend(t);
    };

    const loadAuditBoard = async () => {
        setAuditLoading(true);
        try {
            const [docs, bookings, boosts, subs] = await Promise.all([
                getTherapists(),
                getAllSessionBookingsForAdmin(),
                getAllTherapistBoostsForAdmin(),
                getAllTherapistSubscriptionsForAdmin()
            ]);
            setTherapists(docs || []);
            setSessionBookings(bookings || []);
            setBoostRequests(boosts || []);
            setSubRequests(subs || []);
        } catch (e) {
            console.error(e);
        } finally {
            setAuditLoading(false);
        }
    };

    const handleAddExpense = async () => {
        if (!newExpense.amount || !newExpense.description) return;
        await addMarketingExpense({
            platform: newExpense.platform as any,
            amount: Number(newExpense.amount),
            description: newExpense.description
        });
        setNewExpense({ platform: 'Facebook', amount: '', description: '' });
        setShowAddModal(false);
        refresh();
    };

    // APPROVALS LOGIC

    // Booking Approval logic
    const handleApproveBooking = async (id: string, clientId: string, therapistId: string) => {
        try {
            await updateSessionBooking(id, { status: 'Session Confirmed' });
            
            // Activate the connection and grant 7 days chat access
            await activateClientTherapistConnection(clientId, therapistId);

            // Notify clients
            await createNotification(
                clientId,
                'Payment Verified, Session Confirmed!',
                'An administrator has verified your NayaPay receipt. Your clinical consultation slot is now fully confirmed! You also have 7 days of chat access with your practitioner.',
                'meeting'
            );

            // Notify matched practitioner for intake details
            await createNotification(
                therapistId,
                'New Consultation Booking Active',
                'Your availability slot is booked. A client has made a payment, and session is added directly to your schedule. A 7-day chat window has also opened.',
                'meeting'
            );

            alert("Session booking approved successfully.");
            loadAuditBoard();
            refresh();
        } catch (e) {
            console.error(e);
            alert("Approval transition error.");
        }
    };

    // Reject Booking logic
    const handleRejectBooking = async () => {
        if (!rejectId) return;
        try {
            const booking = sessionBookings.find(b => b.id === rejectId);
            if (!booking) return;

            await updateSessionBooking(rejectId, { status: 'Payment Rejected', notes: rejectReason || null });
            
            await createNotification(
                booking.clientId,
                'Booking Payment Proof Denied',
                `Your session deposit is audited & rejected. Reason: ${rejectReason || 'Invalid receipt payload.'}. Please resubmit right away.`,
                'meeting'
            );

            alert("Session transaction proof rejected.");
            setRejectId(null);
            setRejectReason('');
            loadAuditBoard();
        } catch (e) {
            console.error(e);
        }
    };

    // Boost approval
    const handleApproveBoost = async (id: string, therapistId: string, packType: string, durationDays: number) => {
        try {
            const now = new Date();
            const future = new Date();
            future.setDate(now.getDate() + durationDays);
            
            await updateTherapistBoost(id, { 
                status: 'Approved', 
                expires_at: future.toISOString() 
            });

            await createNotification(
                therapistId,
                'Practice Boost Approved & Live!',
                `Congratulations! Your ${packType} boost package is fully approved. You will hold premium placement search results until ${future.toLocaleDateString()}.`,
                'system'
            );

            alert("Practice boost successfully authenticated.");
            loadAuditBoard();
        } catch (e) {
            console.error(e);
        }
    };

    const handleRejectBoost = async (id: string, therapistId: string) => {
        try {
            await updateTherapistBoost(id, { status: 'Rejected' });
            await createNotification(
                therapistId,
                'Promote Boost Deposit Rejected',
                'The system finance administrator could not verify your directory boost payment. Feel free to re-submit.',
                'alert'
            );
            alert("Directory boost request rejected.");
            loadAuditBoard();
        } catch (e) {
            console.error(e);
        }
    };

    // Pro subscription approval
    const handleApproveSub = async (id: string, therapistId: string) => {
        try {
            const future = new Date();
            future.setDate(future.getDate() + 30); // 30 days subscription length default

            await updateTherapistSubscription(id, {
                status: 'Approved',
                expires_at: future.toISOString()
            });

            await createNotification(
                therapistId,
                'Therapist Pro Account Activated',
                'Congratulations, your Pro premium subscription is verified! Your profile badge, premium tools, and priority analytics are active.',
                'system'
            );

            alert("Therapist Pro subscription approved.");
            loadAuditBoard();
        } catch (e) {
            console.error(e);
        }
    };

    const handleRejectSub = async (id: string, therapistId: string) => {
        try {
            await updateTherapistSubscription(id, { status: 'Rejected' });
            await createNotification(
                therapistId,
                'Pro Subscription Deposit Rejected',
                'Your Pro upgrade payment proof failed matching system verification checks. Please correct invoice and re-upload.',
                'alert'
            );
            alert("Therapist Pro subscription rejected.");
            loadAuditBoard();
        } catch (e) {
            console.error(e);
        }
    };

    const formatCurrency = (amount: number) => 
        new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount);

    if (!stats) return (
        <div className="space-y-8 pb-10">
            <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );

    const budgetTotal = 50000; // Mock Budget
    const budgetUsedPercent = Math.min(100, (stats.marketing / budgetTotal) * 100);

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Finance & Analytics</h1>
                    <p className="text-slate-500 text-sm mt-1">Platform health, P&L, and expense tracking.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowPayoutModal(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700">
                        💸 Payout Queue
                    </button>
                    <button className="px-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300">
                        📥 Export CSV
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 shadow-lg">
                        + Add Expense
                    </button>
                </div>
            </div>

            {/* SECTION A: High-Level Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Revenue</div>
                        <div className="text-3xl font-bold text-slate-800 dark:text-white">{formatCurrency(stats.revenue)}</div>
                        <div className="text-xs text-teal-600 font-bold mt-2">↑ 12% vs last month</div>
                    </div>
                    <div className="absolute right-0 top-0 w-24 h-24 bg-slate-50 dark:bg-navy-700 rounded-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
                </div>

                <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Platform Profit (20%)</div>
                        <div className="text-3xl font-bold text-teal-600">{formatCurrency(stats.profit)}</div>
                        <div className="text-xs text-slate-400 mt-2">Before expenses</div>
                    </div>
                    <div className="absolute right-0 top-0 w-24 h-24 bg-teal-50 dark:bg-teal-900/20 rounded-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
                </div>

                <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Marketing Spend</div>
                        <div className="text-3xl font-bold text-rose-500">{formatCurrency(stats.marketing)}</div>
                        <div className="text-xs text-slate-400 mt-2">{budgetUsedPercent.toFixed(0)}% of monthly budget</div>
                    </div>
                    <div className="absolute right-0 top-0 w-24 h-24 bg-rose-50 dark:bg-rose-900/20 rounded-full -mr-8 -mt-8 opacity-50 group-hover:scale-110 transition-transform"></div>
                </div>

                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Net Profit</div>
                        <div className="text-3xl font-bold">{formatCurrency(stats.net_income)}</div>
                        <div className="text-xs text-emerald-400 font-bold mt-2">Liquid Cash</div>
                    </div>
                    <div className="absolute right-0 bottom-0 w-32 h-32 bg-teal-500 blur-[60px] opacity-20"></div>
                </div>
            </div>

            {/* PAYMENT VERIFICATION AND PRO AUDITS BOARD */}
            <div className="bg-white dark:bg-navy-800 p-8 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-navy-750 pb-5">
                <div>
                  <h3 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5.5 h-5.5 text-teal-600" />
                    Transaction & Support Audit Board
                  </h3>
                  <p className="text-xs text-slate-400">Validate manual wallet deposits from clients and upgrade visibility boosts.</p>
                </div>

                {/* Audit Tab selection pills */}
                <div className="flex bg-slate-50 dark:bg-navy-950 p-1 rounded-xl border border-slate-100 dark:border-navy-800">
                  <button 
                    onClick={() => setAuditTab('bookings')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${auditTab === 'bookings' ? 'bg-teal-600 text-white shadow' : 'text-slate-500'}`}
                  >
                    Booking Fees ({sessionBookings.filter(b => b.status === 'Payment Under Review').length})
                  </button>
                  <button 
                    onClick={() => setAuditTab('boosts')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${auditTab === 'boosts' ? 'bg-teal-600 text-white shadow' : 'text-slate-500'}`}
                  >
                    Directory Boosts ({boostRequests.filter(b => b.status === 'Pending').length})
                  </button>
                  <button 
                    onClick={() => setAuditTab('subs')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${auditTab === 'subs' ? 'bg-teal-600 text-white shadow' : 'text-slate-500'}`}
                  >
                    Pro Upgrades ({subRequests.filter(b => b.status === 'Pending').length})
                  </button>
                  <button 
                    onClick={() => setAuditTab('accounts')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${auditTab === 'accounts' ? 'bg-cyan-600 text-white shadow' : 'text-slate-500'}`}
                  >
                    Therapist Accounts
                  </button>
                </div>
              </div>

              {auditLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  
                  {/* SESSION BOOKINGS LIST */}
                  {auditTab === 'bookings' && (
                    sessionBookings.filter(b => b.status === 'Payment Under Review').length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs">No pending client booking deposits to review.</div>
                    ) : (
                      <div className="space-y-3">
                        {sessionBookings.filter(b => b.status === 'Payment Under Review').map(booking => {
                          const doc = therapists.find(t => t.id === booking.therapistId);
                          return (
                            <div key={booking.id} className="p-5 border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                              <div className="flex gap-4">
                                <div className="p-3 bg-teal-100/40 text-teal-700 rounded-xl max-h-11 flex items-center justify-center font-bold">Rs</div>
                                <div className="space-y-1">
                                  <div className="font-bold text-sm text-slate-800 dark:text-white">Fee deposit verification for Dr. {doc?.name || 'Licensed specialist'}</div>
                                  <p className="text-xs text-slate-500">Method: NayaPay • Client ID: <span className="font-mono bg-slate-100 dark:bg-navy-900 px-1 py-0.5 rounded text-[10px]">{booking.clientId.slice(0, 8)}</span></p>
                                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    {booking.date} • {booking.timeSlot} ({booking.sessionType} hour)
                                  </p>
                                  {booking.notes && <p className="text-[11px] text-slate-500 bg-white dark:bg-navy-900 p-2 border border-slate-100 dark:border-navy-800 rounded-lg italic mt-1 font-sans">Intake Note: "{booking.notes}"</p>}
                                </div>
                              </div>

                              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
                                <div className="text-left md:text-right">
                                  <div className="text-lg font-black text-teal-600">PKR {booking.fee?.toLocaleString()}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">Trx Reference: <span className="font-mono text-slate-600 dark:text-teal-400 font-bold select-all">{booking.transactionId || 'Not Specified'}</span></div>
                                </div>

                                <div className="flex gap-2 items-center w-full md:w-auto shrink-0">
                                  {booking.paymentScreenshot && (
                                    <button 
                                      type="button"
                                      onClick={() => setZoomImage(booking.paymentScreenshot)}
                                      className="p-2.5 bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 rounded-xl text-slate-700 dark:text-white flex items-center gap-1.5 text-xs font-bold"
                                      title="Review receipt"
                                    >
                                      <Eye className="w-4 h-4" />
                                      View Invoice Proof
                                    </button>
                                  )}
                                  
                                  <button 
                                    onClick={() => handleApproveBooking(booking.id, booking.clientId, booking.therapistId)}
                                    className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-1 text-xs font-bold shadow-md"
                                  >
                                    <Check className="w-4 h-4" />
                                    Approve
                                  </button>
                                  <button 
                                    onClick={() => setRejectId(booking.id)}
                                    className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center justify-center gap-1 text-xs font-bold shadow"
                                  >
                                    <X className="w-4 h-4" />
                                    Deny proof
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* DIRECTORY BOOSTS AUDIT LIST */}
                  {auditTab === 'boosts' && (
                    boostRequests.filter(b => b.status === 'Pending').length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs">No pending therapist directory boost deposits to review.</div>
                    ) : (
                      <div className="space-y-3">
                        {boostRequests.filter(b => b.status === 'Pending').map(boost => {
                          const doc = therapists.find(t => t.id === boost.therapistId);
                          return (
                            <div key={boost.id} className="p-5 border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                              <div className="flex gap-4">
                                <span className="text-2xl p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">🚀</span>
                                <div>
                                  <div className="font-bold text-sm text-slate-800 dark:text-white">{boost.packageType} Promotion Program</div>
                                  <p className="text-xs text-slate-500">Therapist: <span className="font-bold text-slate-700 dark:text-white">Dr. {doc?.name || boost.therapistId}</span> • Specialty: {doc?.specialty}</p>
                                  <p className="text-[11px] text-slate-400">Duration Period: {boost.durationDays} days visibility upgrade</p>
                                </div>
                              </div>

                              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
                                <div className="text-left md:text-right">
                                  <div className="text-lg font-black text-indigo-600">PKR {boost.cost?.toLocaleString()}</div>
                                  <span className="block text-[9px] uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-bold mt-1 w-fit ml-auto">Deposit review</span>
                                </div>

                                <div className="flex gap-2 items-center self-end md:self-center shrink-0">
                                  {boost.paymentScreenshot && (
                                    <button 
                                      type="button"
                                      onClick={() => setZoomImage(boost.paymentScreenshot)}
                                      className="p-2.5 bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 rounded-xl text-indigo-600 dark:text-indigo-100 flex items-center gap-1 text-xs font-bold"
                                    >
                                      <Eye className="w-4 h-4" />
                                      Receipt Proof
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleApproveBoost(boost.id, boost.therapistId, boost.packageType, boost.durationDays)}
                                    className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1 text-xs font-bold shadow-md"
                                  >
                                    <Check className="w-4 h-4" />
                                    Activate Boost
                                  </button>
                                  <button 
                                    onClick={() => handleRejectBoost(boost.id, boost.therapistId)}
                                    className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-1 text-xs font-bold shadow"
                                  >
                                    <X className="w-4 h-4" />
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* PRO SUBSCRIPTIONS AUDIT LIST */}
                  {auditTab === 'subs' && (
                    subRequests.filter(s => s.status === 'Pending').length === 0 ? (
                      <div className="text-center py-12 text-slate-400 text-xs">No pending therapist Pro account upgrades to review.</div>
                    ) : (
                      <div className="space-y-3">
                        {subRequests.filter(s => s.status === 'Pending').map(sub => {
                          const doc = therapists.find(t => t.id === sub.therapistId);
                          return (
                            <div key={sub.id} className="p-5 border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                              <div className="flex gap-4">
                                <span className="text-2xl p-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center">👑</span>
                                <div>
                                  <div className="font-bold text-sm text-slate-800 dark:text-white">PRO Tier Professional Membership Upgrade</div>
                                  <p className="text-xs text-slate-500">Therapist Upgrade: <span className="font-bold text-slate-700 dark:text-white">Dr. {doc?.name || sub.therapistId}</span></p>
                                  <p className="text-[11px] text-slate-400">Unlock: Pro badge status + advance platform analytics panels</p>
                                </div>
                              </div>

                              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
                                <div className="text-left md:text-right">
                                  <div className="text-lg font-black text-amber-600">PKR {sub.cost?.toLocaleString()}</div>
                                  <span className="block text-[9px] uppercase bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded font-bold mt-1 w-fit ml-auto">Upgrade review</span>
                                </div>

                                <div className="flex gap-2 items-center self-end md:self-center shrink-0">
                                  {sub.paymentScreenshot && (
                                    <button 
                                      type="button"
                                      onClick={() => setZoomImage(sub.paymentScreenshot)}
                                      className="p-2.5 bg-slate-200 dark:bg-navy-700 hover:bg-slate-300 rounded-xl text-amber-600 dark:text-amber-100 flex items-center gap-1 text-xs font-bold"
                                    >
                                      <Eye className="w-4 h-4" />
                                      Receipt Proof
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleApproveSub(sub.id, sub.therapistId)}
                                    className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1 text-xs font-bold shadow-md"
                                  >
                                    <Check className="w-4 h-4" />
                                    Verify PRO
                                  </button>
                                  <button 
                                    onClick={() => handleRejectSub(sub.id, sub.therapistId)}
                                    className="p-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-1 text-xs font-bold shadow"
                                  >
                                    <X className="w-4 h-4" />
                                    Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* THERAPIST ACCOUNTS TABLE */}
                  {auditTab === 'accounts' && (
                    <div className="overflow-x-auto border border-slate-200 dark:border-navy-700 rounded-xl bg-white dark:bg-navy-800 mt-4">
                      <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                        <thead className="text-xs uppercase bg-slate-50 dark:bg-navy-950 text-slate-500 font-bold">
                          <tr>
                            <th className="px-4 py-3">Therapist</th>
                            <th className="px-4 py-3">Bank Details</th>
                            <th className="px-4 py-3">Rates</th>
                            <th className="px-4 py-3">Performance</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                          {therapists.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors">
                              <td className="px-4 py-4">
                                <div className="font-bold text-slate-800 dark:text-white">Dr. {t.name}</div>
                                <div className="text-xs text-slate-500">{t.email}</div>
                              </td>
                              <td className="px-4 py-4 max-w-[200px] truncate text-xs">
                                {t.bankDetails && t.bankDetails.iban ? (
                                  <>
                                    <div className="font-bold">{t.bankDetails.bankName}</div>
                                    <div className="text-slate-400">{t.bankDetails.iban}</div>
                                    <div className="text-slate-400 flex items-center justify-between">
                                        <span>{t.bankDetails.accountTitle}</span>
                                        <button 
                                            title="Request Change / Unlock Settings"
                                            onClick={async () => {
                                                if (confirm(`Unlock bank details for Dr. ${t.name}?`)) {
                                                    await unlockTherapistBankDetails(t.id);
                                                    alert("Unlocked and therapist notified.");
                                                    loadAuditBoard();
                                                }
                                            }}
                                            className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded hover:bg-teal-100"
                                        >
                                            Unlock
                                        </button>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-rose-400 italic font-medium">Pending setup</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-xs space-y-1">
                                <div className="flex justify-between gap-4">
                                  <span className="text-slate-400">Rate:</span> 
                                  <span className="font-bold text-slate-800 dark:text-white">PKR {(t.pricing60 || 0).toLocaleString()} / hr</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-xs space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-amber-500 text-sm">★</span> 
                                  <span className="font-bold text-slate-800 dark:text-white">{typeof t.rating === 'number' ? t.rating.toFixed(1) : t.rating}</span>
                                  <span className="text-slate-400">({t.reviewCount} revs)</span>
                                </div>
                                <div className="text-slate-500">{(t.reviewCount || 0) * 3} Sessions</div>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${t.status === 'LIVE' ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500'}`}>
                                  {t.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* SECTION B: Charts & Leaderboards */}
            <div className="grid md:grid-cols-3 gap-8">
                {/* Revenue Chart */}
                <div className="md:col-span-2 bg-white dark:bg-navy-800 p-8 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Revenue Trend</h3>
                        <select className="bg-slate-50 dark:bg-navy-950 border-none text-xs font-bold text-slate-500 rounded-lg p-2">
                            <option>This Month</option>
                            <option>Last 3 Months</option>
                        </select>
                    </div>
                    <RevenueChart data={revenueTrend} />
                </div>

                {/* Top Performers (Leaderboard) */}
                <div className="bg-white dark:bg-navy-800 p-8 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">🏆 Top Performers</h3>
                    
                    <div className="space-y-6">
                        {/* Therapist */}
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shadow-sm">🩺</div>
                            <div>
                                <div className="text-xs text-slate-400 font-bold uppercase">Top Therapist</div>
                                <div className="font-bold text-slate-800 dark:text-white">{stats.top_therapist.name}</div>
                                <div className="text-xs text-teal-600 font-bold">Generates {formatCurrency(stats.top_therapist.total)}</div>
                            </div>
                        </div>

                        {/* Client */}
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl shadow-sm">👤</div>
                            <div>
                                <div className="text-xs text-slate-400 font-bold uppercase">Top Client</div>
                                <div className="font-bold text-slate-800 dark:text-white">{stats.top_client.name}</div>
                                <div className="text-xs text-indigo-500 font-bold">Spent {formatCurrency(stats.top_client.total)}</div>
                            </div>
                        </div>

                        {/* Activity */}
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-xl shadow-sm">🔥</div>
                            <div>
                                <div className="text-xs text-slate-400 font-bold uppercase">Most Active</div>
                                <div className="font-bold text-slate-800 dark:text-white">{stats.most_active.name}</div>
                                <div className="text-xs text-rose-500 font-bold">{stats.most_active.sessions} Sessions</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION C: Payout Management */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-navy-800 p-8 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-sm">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6">Payout Liabilities</h3>
                    
                    <div className="flex items-center gap-6 mb-6">
                        <div className="flex-1 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900">
                            <div className="text-xs text-amber-700 font-bold uppercase mb-1">Pending Clearance</div>
                            <div className="text-2xl font-bold text-amber-800 dark:text-amber-500">{formatCurrency(stats.pending_payouts)}</div>
                            <div className="text-xs text-amber-600 mt-1">Held for 29 days</div>
                        </div>
                        <div className="flex-1 p-4 bg-teal-50 dark:bg-teal-900/10 rounded-2xl border border-teal-100 dark:border-teal-900">
                            <div className="text-xs text-teal-700 font-bold uppercase mb-1">Cleared for Pay</div>
                            <div className="text-2xl font-bold text-teal-800 dark:text-teal-500">{formatCurrency(stats.cleared_payouts)}</div>
                            <div className="text-xs text-teal-600 mt-1">Ready for transfer</div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setShowPayoutModal(true)}
                        className="w-full py-3 border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                        View Detailed Payout Queue →
                    </button>
                </div>

                {/* SECTION D: Marketing Budget Tracker */}
                <div className="bg-white dark:bg-navy-800 p-8 rounded-3xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Marketing Budget</h3>
                        <span className="text-xs font-bold bg-slate-100 dark:bg-navy-700 px-3 py-1 rounded-full text-slate-600 dark:text-slate-300">
                            Limit: {formatCurrency(budgetTotal)}
                        </span>
                    </div>

                    <div className="mb-6">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                            <span>Used: {formatCurrency(stats.marketing)}</span>
                            <span>{budgetUsedPercent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 dark:bg-navy-950 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ${budgetUsedPercent > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} 
                                style={{ width: `${budgetUsedPercent}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 max-h-48 pr-2">
                        {expenses.map(exp => (
                            <div key={exp.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-navy-950 rounded-xl border border-slate-100 dark:border-navy-800">
                                <div>
                                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{exp.platform}</div>
                                    <div className="text-xs text-slate-400">{exp.description}</div>
                                </div>
                                <div className="text-sm font-bold text-slate-800 dark:text-white">
                                    - {formatCurrency(exp.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-scale-in">
                    <div className="bg-white dark:bg-navy-900 w-full max-w-sm p-8 rounded-3xl shadow-2xl">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Log Expense</h2>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Platform</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800"
                                    value={newExpense.platform}
                                    onChange={e => setNewExpense({...newExpense, platform: e.target.value})}
                                >
                                    <option>Facebook</option><option>Google</option><option>Instagram</option><option>Influencer</option><option>Server</option><option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (PKR)</label>
                                <input 
                                    type="number"
                                    className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800"
                                    value={newExpense.amount}
                                    onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                <input 
                                    className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800"
                                    value={newExpense.description}
                                    onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                            <button onClick={handleAddExpense} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* REJECTION REASON INPUT DRAWER */}
            {rejectId && (
              <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
                <div className="bg-white dark:bg-navy-800 rounded-3xl w-full max-w-sm p-8 border border-slate-100 dark:border-navy-750 shadow-2xl animate-scale-in">
                  <h3 className="font-bold text-lg text-slate-850 dark:text-white mb-2">Reject Deposit proof</h3>
                  <p className="text-xs text-slate-400 mb-6">Clarify the core reason so clients can re-upload corrections.</p>
                  
                  <textarea 
                    rows={3}
                    className="w-full p-3 outline-none border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 rounded-xl text-xs"
                    placeholder="e.g. The uploaded receipt does not show the correct account transaction timestamp. Please retransfer."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    required
                  />

                  <div className="flex gap-3.5 mt-6 pt-2">
                    <button 
                      type="button" 
                      onClick={() => { setRejectId(null); setRejectReason(''); }}
                      className="flex-1 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-50 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={handleRejectBooking}
                      disabled={!rejectReason}
                      className="flex-1 py-2.5 text-xs text-white font-bold bg-rose-600 hover:bg-rose-700 rounded-xl shadow disabled:opacity-50"
                    >
                      Deny Payment Proof
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ZOOM RECEIPT IMAGE MODAL */}
            {zoomImage && (
              <div 
                className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm p-6 flex flex-col items-center justify-center"
                onClick={() => setZoomImage(null)}
              >
                <div className="relative max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border-4 border-slate-800 shadow-2xl bg-slate-900" onClick={e => e.stopPropagation()}>
                  <img src={zoomImage} className="max-w-full max-h-[75vh] object-contain rounded-lg" alt="Audited proof zoomed" />
                  <div className="p-4 bg-slate-950 text-center flex justify-between items-center">
                    <span className="text-xs text-slate-400">Click outer mask to exit magnifier</span>
                    <button 
                      onClick={() => setZoomImage(null)}
                      className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700"
                    >
                      Close Zoom
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showPayoutModal && <PayoutQueueModal onClose={() => setShowPayoutModal(false)} />}
        </div>
    );
};
