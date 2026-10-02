import React, { useState, useEffect } from 'react';
import { UserSettings } from '../../types';
import { Check, X, Eye, FileText, Ban, Trash2, CalendarPlus } from 'lucide-react';
import { Skeleton } from '../../components/Skeleton';

export const SubscriptionsDashboard = () => {
    const [plans, setPlans] = useState<any[]>([]);
    const [subs, setSubs] = useState<any[]>([]);
    const [purchases, setPurchases] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'analytics'|'verifications'|'list'>('analytics');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [pRes, sRes, purRes, uRes] = await Promise.all([
                fetch('/api/db/select', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ table: 'subscription_plans' }) }),
                fetch('/api/db/select', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ table: 'user_subscriptions' }) }),
                fetch('/api/db/select', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ table: 'purchase_history', orderCol: 'created_at', orderOpts: {ascending: false} }) }),
                fetch('/api/db/select', { method: 'POST', headers: { 'content-type':'application/json' }, body: JSON.stringify({ table: 'users' }) })
            ]);

            setPlans((await pRes.json()).data || []);
            setSubs((await sRes.json()).data || []);
            setPurchases((await purRes.json()).data || []);
            setUsers((await uRes.json()).data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (purchase: any, action: 'Approve' | 'Reject') => {
        if (!confirm(`Are you sure you want to ${action} this transaction?`)) return;
        
        try {
            const newStatus = action === 'Approve' ? 'Completed' : 'Rejected';
            
            // 1. Update purchase_history
            await fetch('/api/db/update', {
                 method: 'POST', headers: {'content-type':'application/json'},
                 body: JSON.stringify({ table: 'purchase_history', values: { status: newStatus }, filters: [{ column: 'id', operator: 'eq', value: purchase.id }] })
            });

            if (action === 'Approve') {
                let existingSub = subs.find(s => s.user_id === purchase.user_id);
                const plan = plans.find(p => p.id === purchase.item_id);
                
                if (plan) {
                    const newExpiry = new Date();
                    if (plan.is_lifetime === 1) {
                        newExpiry.setFullYear(newExpiry.getFullYear() + 100);
                    } else {
                        newExpiry.setMonth(newExpiry.getMonth() + (plan.duration_months || 1));
                    }
                    
                    if (existingSub) {
                        await fetch('/api/db/update', {
                             method: 'POST', headers: {'content-type':'application/json'},
                             body: JSON.stringify({ 
                                 table: 'user_subscriptions', 
                                 values: { 
                                     plan_id: purchase.item_id,
                                     status: 'Active', 
                                     expiry_date: newExpiry.toISOString(),
                                     updated_at: new Date().toISOString()
                                 },
                                 filters: [{ column: 'id', operator: 'eq', value: existingSub.id }]
                             })
                        });
                    } else {
                        // Generate a safe unique ID since crypto.randomUUID() is only available on HTTPS
                        const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                            ? crypto.randomUUID() 
                            : 'sub-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
                            
                        await fetch('/api/db/insert', {
                             method: 'POST', headers: {'content-type':'application/json'},
                             body: JSON.stringify({ 
                                 table: 'user_subscriptions', 
                                 values: [{ 
                                     id: newId,
                                     user_id: purchase.user_id,
                                     plan_id: purchase.item_id,
                                     status: 'Active', 
                                     expiry_date: newExpiry.toISOString(),
                                     updated_at: new Date().toISOString()
                                 }] 
                             })
                        });
                    }
                }
                
                const notifId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'notif-' + Math.random().toString(36).substring(2);
                await fetch('/api/db/insert', {
                    method: 'POST', headers: {'content-type':'application/json'},
                    body: JSON.stringify({
                         table: 'notifications',
                         values: [{
                             id: notifId, user_id: purchase.user_id,
                             title: 'Payment Approved', message: `Your payment of PKR ${purchase.amount.toLocaleString()} has been verified. Your subscription is now Active.`, type: 'system', is_read: 0, created_at: new Date().toISOString()
                         }]
                    })
                });
            } else {
                // If rejected, leave sub as Pending Validation (need to request new receipt), but notify
                // The prompt says: "If payment rejected: Subscription Status: Pending, User receives: 'Your payment could not be verified. Please upload a new payment receipt.'"
                let userSub = subs.find(s => s.user_id === purchase.user_id && s.plan_id === purchase.item_id && s.status === 'Pending Validation')
                              || subs.find(s => s.user_id === purchase.user_id && s.status === 'Pending Validation');

                if (userSub) {
                    await fetch('/api/db/update', {
                         method: 'POST', headers: {'content-type':'application/json'},
                         body: JSON.stringify({ table: 'user_subscriptions', values: { status: 'Pending Validation' }, filters: [{ column: 'id', operator: 'eq', value: userSub.id }] })
                    });
                }
                
                const notifId2 = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'notif-' + Math.random().toString(36).substring(2);
                await fetch('/api/db/insert', {
                    method: 'POST', headers: {'content-type':'application/json'},
                    body: JSON.stringify({
                         table: 'notifications',
                         values: [{
                             id: notifId2, user_id: purchase.user_id,
                             title: 'Payment Rejected', message: `Your payment of PKR ${purchase.amount.toLocaleString()} could not be verified. Please upload a new payment receipt.`, type: 'system', is_read: 0, created_at: new Date().toISOString()
                         }]
                    })
                });
            }
            alert(`Payment successfully ${action}d.`);
            fetchData();
        } catch(e) {
            alert(`Error: ${e}`);
        }
    };

    const handleSubAction = async (sub: any, action: 'Suspend' | 'Cancel' | 'Extend') => {
        if (!confirm(`Are you sure you want to ${action} this subscription?`)) return;
        try {
            if (action === 'Extend') {
                const currentExpiry = new Date(sub.expiry_date);
                currentExpiry.setMonth(currentExpiry.getMonth() + 1);
                await fetch('/api/db/update', {
                    method: 'POST', headers: {'content-type':'application/json'},
                    body: JSON.stringify({ table: 'user_subscriptions', values: { expiry_date: currentExpiry.toISOString() }, filters: [{ column: 'id', type: 'eq', value: sub.id }] })
                });
            } else {
                const newStatus = action === 'Suspend' ? 'Suspended' : 'Cancelled';
                await fetch('/api/db/update', {
                    method: 'POST', headers: {'content-type':'application/json'},
                    body: JSON.stringify({ table: 'user_subscriptions', values: { status: newStatus }, filters: [{ column: 'id', type: 'eq', value: sub.id }] })
                });
            }
            fetchData();
        } catch (e) {
            alert(`Error updating subscription: ${e}`);
        }
    };

    const activeSubs = subs.filter(s => s.status === 'Active' && new Date(s.expiry_date) > new Date());
    const expiredSubs = subs.filter(s => s.status === 'Expired' || new Date(s.expiry_date) <= new Date());
    
    // Revenue calculations
    const completedPurchases = purchases.filter(p => p.status === 'Completed');
    const totalRevenue = completedPurchases.reduce((acc, curr) => acc + curr.amount, 0);
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyRevenue = completedPurchases.filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((acc, curr) => acc + curr.amount, 0);

    const annualRevenue = completedPurchases.filter(p => {
        return new Date(p.created_at).getFullYear() === currentYear;
    }).reduce((acc, curr) => acc + curr.amount, 0);

    const totalUsers = users.length;
    const conversionRate = totalUsers > 0 ? ((activeSubs.length / totalUsers) * 100).toFixed(1) : '0.0';

    const pendingVerifications = purchases.filter(p => p.status === 'Pending' && p.payment_method === 'Bank Transfer');

    const lifetimeCount = activeSubs.filter(s => {
        const p = plans.find(pl => pl.id === s.plan_id);
        return p && p.is_lifetime === 1;
    }).length;

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText className="text-teal-500" /> Subscription & Billing
                </h1>
                <div className="flex bg-slate-100 dark:bg-navy-900 rounded-lg p-1">
                    <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'analytics' ? 'bg-white dark:bg-navy-700 text-teal-600 shadow-sm' : 'text-slate-500'}`}>Overview</button>
                    <button onClick={() => setActiveTab('list')} className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'list' ? 'bg-white dark:bg-navy-700 text-teal-600 shadow-sm' : 'text-slate-500'}`}>Subscriptions</button>
                    <button onClick={() => setActiveTab('verifications')} className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-all ${activeTab === 'verifications' ? 'bg-white dark:bg-navy-700 text-teal-600 shadow-sm' : 'text-slate-500'}`}>
                        Verifications {pendingVerifications.length > 0 && <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-xs">{pendingVerifications.length}</span>}
                    </button>
                </div>
            </div>

            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
                            <div className="text-xs text-slate-500 uppercase font-bold">Active Subscriptions</div>
                            <div className="text-2xl font-bold text-teal-600">
                                {loading ? <Skeleton className="h-8 w-16" /> : activeSubs.length}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
                            <div className="text-xs text-slate-500 uppercase font-bold">Pending Approvals</div>
                            <div className="text-2xl font-bold text-amber-500">
                                {loading ? <Skeleton className="h-8 w-16" /> : pendingVerifications.length}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
                            <div className="text-xs text-slate-500 uppercase font-bold">Expired Plans</div>
                            <div className="text-2xl font-bold text-rose-500">
                                {loading ? <Skeleton className="h-8 w-16" /> : expiredSubs.length}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
                            <div className="text-xs text-slate-500 uppercase font-bold">Conversion Rate</div>
                            <div className="text-2xl font-bold text-indigo-500">
                                {loading ? <Skeleton className="h-8 w-16" /> : `${conversionRate}%`}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
                            <div className="text-xs text-slate-500 uppercase font-bold">Monthly Revenue</div>
                            <div className="text-2xl font-bold text-emerald-600">
                                {loading ? <Skeleton className="h-8 w-32" /> : `PKR ${monthlyRevenue.toLocaleString()}`}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
                            <div className="text-xs text-slate-500 uppercase font-bold">Annual Revenue</div>
                            <div className="text-2xl font-bold text-emerald-600">
                                {loading ? <Skeleton className="h-8 w-32" /> : `PKR ${annualRevenue.toLocaleString()}`}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-navy-700">
                            <div className="text-xs text-slate-500 uppercase font-bold">Lifetime Revenue</div>
                            <div className="text-2xl font-bold text-emerald-600">
                                {loading ? <Skeleton className="h-8 w-32" /> : `PKR ${totalRevenue.toLocaleString()}`}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="bg-white dark:bg-navy-800 p-0 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-navy-900 text-slate-500 uppercase text-xs">
                                <tr>
                                    <th className="p-3">User Name</th>
                                    <th className="p-3">Email</th>
                                    <th className="p-3">Plan Type</th>
                                    <th className="p-3">Payment</th>
                                    <th className="p-3">Sub Status</th>
                                    <th className="p-3">Purchase Date</th>
                                    <th className="p-3">Expiry Date</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="p-3"><Skeleton className="h-4 w-28" /></td>
                                            <td className="p-3"><Skeleton className="h-4 w-36" /></td>
                                            <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                                            <td className="p-3"><Skeleton className="h-4 w-16" /></td>
                                            <td className="p-3"><Skeleton className="h-4 w-16" /></td>
                                            <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                                            <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                                            <td className="p-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : subs.map((s, i) => {
                                    const user = users.find(u => u.id === s.user_id) || {};
                                    const plan = plans.find(pl => pl.id === s.plan_id) || {};
                                    const latestPurchase = purchases.find(p => p.item_id === s.plan_id && p.user_id === s.user_id);
                                    
                                    return (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-navy-900/50 transition-colors">
                                            <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{user.display_name || 'Unknown User'}</td>
                                            <td className="p-3 text-slate-500">{user.email || 'N/A'}</td>
                                            <td className="p-3 font-medium text-teal-600">{plan.name || 'Unknown'}</td>
                                            <td className="p-3">
                                                 <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${latestPurchase?.status === 'Completed' ? 'bg-green-100 text-green-700' : latestPurchase?.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                                     {latestPurchase?.status || 'Unknown'}
                                                 </span>
                                            </td>
                                            <td className="p-3">
                                                 <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${s.status === 'Active' ? 'bg-green-100 text-green-700' : s.status === 'Pending Validation' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                                     {s.status}
                                                 </span>
                                            </td>
                                            <td className="p-3 text-slate-500 text-xs">{latestPurchase ? new Date(latestPurchase.created_at).toLocaleDateString() : 'N/A'}</td>
                                            <td className="p-3 text-slate-500 text-xs">{s.expiry_date ? new Date(s.expiry_date).toLocaleDateString() : 'N/A'}</td>
                                            <td className="p-3 flex justify-end gap-1">
                                                <button onClick={() => alert(JSON.stringify(s, null, 2))} className="p-1.5 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="View"><Eye size={16}/></button>
                                                {s.status === 'Active' && <button onClick={() => handleSubAction(s, 'Extend')} className="p-1.5 text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded" title="Extend"><CalendarPlus size={16}/></button>}
                                                {s.status === 'Active' && <button onClick={() => handleSubAction(s, 'Suspend')} className="p-1.5 text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded" title="Suspend"><Ban size={16}/></button>}
                                                {s.status !== 'Cancelled' && <button onClick={() => handleSubAction(s, 'Cancel')} className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded" title="Cancel"><Trash2 size={16}/></button>}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!loading && subs.length === 0 && (
                                    <tr><td colSpan={8} className="p-8 text-center text-slate-500">No subscriptions found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'verifications' && (
                <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-700">
                    <h2 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Bank Transfer Authorizations</h2>
                    {loading ? (
                        <div className="space-y-4">
                            {Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 animate-pulse">
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-1/3" />
                                        <Skeleton className="h-4 w-1/2" />
                                        <Skeleton className="h-4 w-1/4" />
                                        <Skeleton className="h-4 w-1/3" />
                                    </div>
                                    <div className="flex flex-col gap-2 md:w-64">
                                        <Skeleton className="h-24 w-full" />
                                        <Skeleton className="h-8 w-full" />
                                        <Skeleton className="h-8 w-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : pendingVerifications.length === 0 ? (
                        <div className="p-10 text-center text-slate-500 bg-slate-50 dark:bg-navy-900 border rounded-2xl border-slate-100 dark:border-navy-800">
                            No pending payments verification requests found.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {pendingVerifications.map((p, i) => (
                                <div key={i} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-navy-900">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Pending Review</span>
                                            <span className="text-slate-400 text-xs">{new Date(p.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="font-medium text-slate-800 dark:text-white">User ID: <span className="font-mono text-sm text-slate-500">{p.user_id}</span></div>
                                        <div className="font-medium text-slate-800 dark:text-white">Amount: <span className="text-teal-600">PKR {p.amount.toLocaleString()}</span></div>
                                        <div className="font-medium text-slate-800 dark:text-white">Ref ID: <span className="font-mono text-sm">{p.transaction_id}</span></div>
                                    </div>
                                    <div className="flex flex-col gap-2 md:w-64">
                                        {p.receipt_url ? (
                                            <div className="bg-white dark:bg-navy-800 p-2 rounded-lg border border-slate-200 dark:border-navy-700 cursor-pointer hover:shadow-md h-24 overflow-hidden relative group" onClick={() => window.open(p.receipt_url, '_blank')}>
                                                 {p.receipt_url.startsWith('data:image') ? (
                                                     <img src={p.receipt_url} className="w-full h-full object-cover rounded opacity-80 group-hover:opacity-100 transition-opacity" alt="Receipt" />
                                                 ) : (
                                                     <div className="flex h-full items-center justify-center text-xs font-mono break-all text-slate-400">{p.receipt_url.substring(0, 50)}...</div>
                                                 )}
                                                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Eye size={20} /></div>
                                            </div>
                                        ) : (
                                            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-navy-700 text-slate-400 text-xs">No Receipt Image</div>
                                        )}
                                        <div className="flex gap-2">
                                            <button onClick={() => handleVerify(p, 'Approve')} className="flex-1 py-1.5 bg-green-500 text-white rounded font-bold text-sm hover:bg-green-600 flex items-center justify-center gap-1"><Check size={16}/> Approve</button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleVerify(p, 'Reject')} className="flex-1 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-900/30 dark:border-rose-900/50 rounded font-bold text-sm hover:bg-rose-100 flex items-center justify-center gap-1"><X size={16}/> Reject/Req</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

