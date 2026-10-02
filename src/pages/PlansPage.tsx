import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { Check, Copy, Upload, ShieldCheck, Sparkles, Clock, Users, Navigation, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const PlansPage = ({ settings, onUpdateUser }: { settings: UserSettings|null, onUpdateUser?: any }) => {
    const [plans, setPlans] = useState<any[]>([]);
    const [mySub, setMySub] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    
    // Payment form
    const [txRef, setTxRef] = useState('');
    const [receiptBase64, setReceiptBase64] = useState<string>('');
    const [submittingPayment, setSubmittingPayment] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    useEffect(() => {
        fetchData();
    }, [settings?.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/db/select', {
                method: 'POST', headers: { 'content-type':'application/json' },
                body: JSON.stringify({ table: 'subscription_plans', filters: [{column: 'is_active', value: 1, type: 'eq'}] })
            });
            const data = await res.json();
            if (data.data) {
                // Ensure Monthly is 2500, Yearly is 17000, Lifetime is 30000
                const updatedPlans = data.data.map((p: any) => {
                    if (p.name === 'Monthly') p.price = 2500;
                    if (p.name === 'Yearly') p.price = 17000;
                    if (p.name === 'Lifetime') p.price = 30000;
                    return p;
                }).sort((a:any, b:any) => a.price - b.price);
                setPlans(updatedPlans);
            }

            if (settings?.id) {
                const subRes = await fetch('/api/db/select', {
                    method: 'POST', headers: { 'content-type':'application/json' },
                    body: JSON.stringify({ table: 'user_subscriptions', filters: [{column: 'user_id', value: settings.id, type: 'eq'}] })
                });
                const subData = await subRes.json();
                if (subData.data && subData.data.length > 0) {
                    setMySub(subData.data[0]);
                }
            }
        } catch(e) {
            console.error("Failed to load plans", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setReceiptBase64(ev.target?.result as string);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleInitiatePurchase = (plan: any) => {
        if (!settings?.id) {
            alert("Please login first to subscribe.");
            return;
        }
        if (plan.price === 0) {
            // Revert to free plan, update subscription
            handleFreeDowngrade(plan);
        } else {
            setSelectedPlan(plan);
            setShowPaymentModal(true);
            setPaymentSuccess(false);
            setTxRef('');
            setReceiptBase64('');
        }
    };

    const handleFreeDowngrade = async (plan: any) => {
        if (confirm("Are you sure you want to switch back to the Free plan? Premium features will be disabled immediately.")) {
            try {
                await fetch('/api/db/upsert', {
                    method: 'POST', headers: { 'content-type':'application/json' },
                    body: JSON.stringify({
                        table: 'user_subscriptions',
                        values: {
                            id: mySub?.id || crypto.randomUUID(),
                            user_id: settings!.id,
                            plan_id: plan.id,
                            status: 'Active',
                            expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 100)).toISOString(),
                            renewal_date: null,
                            updated_at: new Date().toISOString()
                        }
                    })
                });
                alert("Switched to Free plan.");
                fetchData();
            } catch (e) {
                console.error(e);
            }
        }
    };

    const submitPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!txRef) return;
        setSubmittingPayment(true);
        try {
            // Cut base64 length if too long (to prevent 413) 
            // In a real app we upload to S3, but here we store text or truncated Data URL
            const finalReceipt = receiptBase64.substring(0, 500000); // truncate arbitrarily to ~500KB

            // Insert Purchase History (Pending)
            await fetch('/api/db/insert', {
                method: 'POST', headers: { 'content-type':'application/json' },
                body: JSON.stringify({
                    table: 'purchase_history',
                    values: [{
                        id: crypto.randomUUID(),
                        user_id: settings!.id,
                        item_type: 'Subscription',
                        item_id: selectedPlan.id,
                        amount: selectedPlan.price,
                        status: 'Pending',
                        payment_method: 'Bank Transfer',
                        transaction_id: txRef,
                        receipt_url: finalReceipt,
                        created_at: new Date().toISOString()
                    }]
                })
            });

            // Upsert User Subscription as Pending (or keep Active if they had one, just create notification)
            const expiry = new Date();
            expiry.setMonth(expiry.getMonth() + selectedPlan.duration_months);

            await fetch('/api/db/upsert', {
                method: 'POST', headers: { 'content-type':'application/json' },
                body: JSON.stringify({
                    table: 'user_subscriptions',
                    values: {
                        id: mySub ? mySub.id : crypto.randomUUID(),
                        user_id: settings!.id,
                        plan_id: selectedPlan.id,
                        status: 'Pending Validation',
                        expiry_date: mySub?.expiry_date || expiry.toISOString(), // Don't extend until verified
                        renewal_date: mySub?.renewal_date || null,
                        updated_at: new Date().toISOString()
                    }
                })
            });

            // Notify Admin (optional table) or just User
            await fetch('/api/db/insert', {
                method: 'POST', headers: { 'content-type':'application/json' },
                body: JSON.stringify({
                    table: 'notifications',
                    values: [{
                        id: crypto.randomUUID(),
                        user_id: settings!.id,
                        title: 'Payment Under Review',
                        message: `Your payment of PKR ${selectedPlan.price.toLocaleString()} for the ${selectedPlan.name} plan is under review. Please allow up to 24 hours.`,
                        type: 'system',
                        is_read: 0,
                        created_at: new Date().toISOString()
                    }]
                })
            });

            setPaymentSuccess(true);
            setTimeout(() => {
                setShowPaymentModal(false);
                fetchData();
            }, 3000);

        } catch (e) {
            console.error(e);
            alert("An error occurred while submitting payment.");
        } finally {
            setSubmittingPayment(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert(`Copied: ${text}`);
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
        </div>
    );

    const activePlanId = mySub && new Date(mySub.expiry_date) > new Date() ? mySub.plan_id : null;
    const isPending = mySub?.status === 'Pending Validation';

    return (
        <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-navy-900 font-sans pb-24">
            {/* Header Promotional Banner */}
            <div className="bg-gradient-to-r from-teal-900 to-teal-700 text-white py-16 px-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
                        <Sparkles size={16} className="text-yellow-300" />
                        <span>Limited Time Offer — Save up to 30% on Yearly Plans</span>
                    </motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                        Invest in Your <span className="text-teal-300">Mental Wellness</span>
                    </motion.h1>
                    <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-lg md:text-xl text-teal-50 mb-10 max-w-2xl mx-auto">
                        Unlock unlimited AI conversations, priority therapist matching, and advanced wellness tools. Cancel anytime. Secure and private.
                    </motion.p>
                    
                    <div className="flex flex-wrap justify-center gap-6 text-sm font-medium opacity-90">
                        <div className="flex items-center gap-2"><ShieldCheck size={18}/> Bank-Level Security</div>
                        <div className="flex items-center gap-2"><Users size={18}/> 10,000+ Happy Users</div>
                        <div className="flex items-center gap-2"><Star size={18}/> 4.9/5 Average Rating</div>
                    </div>
                </div>
            </div>

            {/* Current Status Banner */}
            <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-20">
                <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between border border-slate-100 dark:border-navy-700">
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                        <div className={`p-3 rounded-xl ${isPending ? 'bg-amber-100 text-amber-600' : 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400'}`}>
                           {isPending ? <Clock size={24} /> : <ShieldCheck size={24} />}
                        </div>
                        <div>
                            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">Your Current Status</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xl font-bold text-slate-800 dark:text-white">
                                    {isPending ? 'Validation Pending' : (mySub?.status === 'Active' ? 'Active Subscription' : 'Free Tier')}
                                </span>
                            </div>
                        </div>
                    </div>
                    {mySub && !isPending && (
                        <div className="text-right">
                            <div className="text-sm font-medium text-slate-500">Expiry Date</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-white">
                                {mySub.expiry_date ? new Date(mySub.expiry_date).toLocaleDateString() : 'Lifetime'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-6xl mx-auto px-4 mt-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                    {plans.map((plan, idx) => {
                        const isActive = activePlanId === plan.id;
                        const isMonthly = plan.name === 'Monthly';
                        const isYearly = plan.name === 'Yearly';
                        const isLifetime = plan.name === 'Lifetime';
                        
                        let cardStyle = "bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700";
                        if (isMonthly) cardStyle = "bg-white dark:bg-navy-800 border-teal-500 shadow-2xl shadow-teal-500/10 lg:scale-105 z-10 block";
                        if (isLifetime) cardStyle = "bg-gradient-to-b from-amber-50 to-white dark:from-navy-800 dark:to-navy-900 border-amber-200 dark:border-amber-900/50";
                        
                        return (
                            <motion.div 
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * idx }}
                                key={plan.id} 
                                className={`relative rounded-3xl border p-6 flex flex-col h-full ${cardStyle}`}
                            >
                                {isMonthly && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-teal-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                                        Most Popular
                                    </div>
                                )}
                                {isActive && (
                                    <div className="absolute top-4 right-4 text-teal-600 bg-teal-50 px-2 py-1 flex items-center gap-1 rounded-md text-xs font-bold">
                                        <Check size={14}/> Current Plan
                                    </div>
                                )}

                                <div className="mb-6">
                                    <h3 className={`text-xl font-bold mb-2 ${isLifetime ? 'text-amber-700 dark:text-amber-500' : 'text-slate-800 dark:text-white'}`}>{plan.name}</h3>
                                    <div className="flex items-end gap-1">
                                        <span className={`text-4xl font-extrabold ${isLifetime ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                                            {plan.price === 0 ? 'Free' : `PKR ${plan.price.toLocaleString()}`}
                                        </span>
                                        {plan.price > 0 && <span className="text-slate-500 font-medium pb-1">/{isLifetime ? 'ever' : (isYearly ? 'yr' : 'mo')}</span>}
                                    </div>
                                    {isYearly && (
                                        <div className="text-sm font-medium text-emerald-500 mt-2 line-through opacity-70">Orig. PKR 24,000</div>
                                    )}
                                    {isYearly && (
                                        <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">Save 29%</div>
                                    )}
                                </div>

                                <ul className="space-y-4 mb-8 flex-1">
                                    <li className="flex items-start gap-3">
                                        <Check size={20} className="text-teal-500 shrink-0 mt-0.5" />
                                        <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">
                                            {plan.max_ai_chats >= 9999 ? 'Unlimited AI Chats' : `${plan.max_ai_chats} AI Chats / day`}
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <Check size={20} className="text-teal-500 shrink-0 mt-0.5" />
                                        <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">
                                            {plan.max_journal_entries >= 9999 ? 'Unlimited Journal' : `${plan.max_journal_entries} Journal Entries`}
                                        </span>
                                    </li>
                                    {plan.priority_matching === 1 && (
                                        <li className="flex items-start gap-3">
                                            <Check size={20} className="text-teal-500 shrink-0 mt-0.5" />
                                            <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">Priority Therapist Matching</span>
                                        </li>
                                    )}
                                    {plan.premium_features === 1 && (
                                        <li className="flex items-start gap-3">
                                            <Check size={20} className="text-teal-500 shrink-0 mt-0.5" />
                                            <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">Premium Tools Unlocked</span>
                                        </li>
                                    )}
                                </ul>

                                <button 
                                    onClick={() => handleInitiatePurchase(plan)}
                                    disabled={isActive || isPending}
                                    className={`w-full py-3.5 rounded-xl font-bold transition-all ${
                                        isActive ? 'bg-slate-100 dark:bg-navy-700 text-slate-400 cursor-not-allowed' : 
                                        isPending ? 'bg-amber-100 text-amber-500 cursor-not-allowed' :
                                        isLifetime ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-white hover:from-amber-600 hover:to-yellow-500 shadow-lg' :
                                        isMonthly ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg' :
                                        plan.price === 0 ? 'bg-slate-100 dark:bg-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-600' :
                                        'bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200 shadow-lg'
                                    }`}
                                >
                                    {isActive ? 'Current Plan' : isPending ? 'Validation Pending' : (plan.price === 0 ? 'Select Free' : (isLifetime ? 'Buy Lifetime Access' : `Subscribe ${plan.name}`))}
                                </button>
                            </motion.div>
                        )
                    })}
                </div>
            </div>

            {/* Payment Modal */}
            <AnimatePresence>
                {showPaymentModal && selectedPlan && !paymentSuccess && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-navy-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        >
                            <div className="bg-teal-600 p-6 text-white text-center shrink-0">
                                <h2 className="text-2xl font-bold mb-1">Complete Your Secure Payment</h2>
                                <p className="text-teal-100 font-medium">Subscribe to {selectedPlan.name} Map - PKR {selectedPlan.price.toLocaleString()}</p>
                            </div>
                            
                            <div className="p-6 overflow-y-auto no-scrollbar">
                                <div className="bg-amber-50 dark:bg-navy-800 border border-amber-200 dark:border-navy-700 rounded-xl p-4 mb-6">
                                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-500 mb-3 flex items-center gap-2"><Sparkles size={16}/> ONLY PAYMENT METHOD: BANK TRANSFER</h4>
                                    <p className="text-xs text-amber-700 dark:text-slate-400 mb-4">Please transfer the exact amount to the account below, then upload the receipt and enter the transaction reference to begin validation.</p>
                                    
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center bg-white dark:bg-navy-900 p-3 rounded-lg border border-slate-100 dark:border-navy-700">
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Bank Name</div>
                                                <div className="font-medium text-slate-800 dark:text-white text-sm">Meezan Bank Ltd</div>
                                            </div>
                                            <button onClick={() => copyToClipboard('Meezan Bank Ltd')} className="text-teal-600 hover:bg-teal-50 p-2 rounded-full"><Copy size={16}/></button>
                                        </div>
                                        <div className="flex justify-between items-center bg-white dark:bg-navy-900 p-3 rounded-lg border border-slate-100 dark:border-navy-700">
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Account Title</div>
                                                <div className="font-medium text-slate-800 dark:text-white text-sm">Sukoon AI Wellness</div>
                                            </div>
                                            <button onClick={() => copyToClipboard('Sukoon AI Wellness')} className="text-teal-600 hover:bg-teal-50 p-2 rounded-full"><Copy size={16}/></button>
                                        </div>
                                        <div className="flex justify-between items-center bg-white dark:bg-navy-900 p-3 rounded-lg border border-slate-100 dark:border-navy-700">
                                            <div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Account Number</div>
                                                <div className="font-mono font-bold text-slate-800 dark:text-white text-sm">0123 4567 8901 2345</div>
                                            </div>
                                            <button onClick={() => copyToClipboard('0123456789012345')} className="text-teal-600 hover:bg-teal-50 p-2 rounded-full"><Copy size={16}/></button>
                                        </div>
                                    </div>
                                </div>

                                <form onSubmit={submitPayment} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Transaction Reference / ID <span className="text-rose-500">*</span></label>
                                        <input 
                                            required
                                            type="text" 
                                            value={txRef}
                                            onChange={e => setTxRef(e.target.value)}
                                            placeholder="e.g. IBFT-12345678"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 outline-none focus:ring-2 focus:ring-teal-500 transition-all font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Upload Payment Receipt <span className="text-rose-500">*</span></label>
                                        <div className="relative border-2 border-dashed border-slate-300 dark:border-navy-600 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors cursor-pointer block">
                                            <input required onChange={handleFileChange} type="file" accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            {receiptBase64 ? (
                                                <div className="text-teal-600 font-bold flex items-center justify-center gap-2">
                                                    <Check size={20} /> Receipt Attached
                                                </div>
                                            ) : (
                                                <div className="text-slate-500 flex flex-col items-center">
                                                    <Upload size={24} className="mb-2" />
                                                    <span className="text-sm font-medium">Click to upload screenshot</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-4">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPaymentModal(false)}
                                            className="flex-1 py-3 rounded-xl font-bold bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            type="submit"
                                            disabled={submittingPayment || !txRef || !receiptBase64}
                                            className="flex-1 py-3 rounded-xl font-bold bg-teal-600 text-white hover:bg-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {submittingPayment ? <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span> : 'Submit Proof'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Success Animation */}
                {showPaymentModal && paymentSuccess && (
                     <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                        <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white dark:bg-navy-900 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl"
                        >
                            <div className="w-20 h-20 bg-teal-100 dark:bg-teal-900 mx-auto rounded-full flex items-center justify-center mb-6">
                                <Check size={40} className="text-teal-600 dark:text-teal-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Request Submitted!</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">Your payment is now under review. You will receive a notification once validated (usually within 24 hrs).</p>
                        </motion.div>
                     </div>
                )}
            </AnimatePresence>
        </div>
    );
};
