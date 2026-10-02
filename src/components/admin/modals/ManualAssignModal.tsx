
import React, { useState } from 'react';
import { SearchableSelect } from '../../SearchableSelect';

interface ManualAssignModalProps {
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
}

export const ManualAssignModal: React.FC<ManualAssignModalProps> = ({ onClose, onSubmit }) => {
    const [clientId, setClientId] = useState('');
    const [clientName, setClientName] = useState('');
    const [therapistId, setTherapistId] = useState('');
    const [therapistName, setTherapistName] = useState('');
    const [duration, setDuration] = useState(45);
    const [frequency, setFrequency] = useState('Weekly');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!clientId || !therapistId) return;
        setLoading(true);
        await onSubmit({ clientId, therapistId, duration, frequency, reason });
        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800 flex justify-between items-center bg-slate-50 dark:bg-navy-950">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Assign Therapist &gt; Manually</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors">✕</button>
                </div>
                <div className="p-6 space-y-6">
                    {/* Section 1 */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">1. Select People</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Client</label>
                                <SearchableSelect role="client" placeholder="🔍 Search Client Name..." onSelect={(id, name) => { setClientId(id); setClientName(name); }} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Therapist</label>
                                <SearchableSelect role="therapist" placeholder="🔍 Search Doctor Name..." onSelect={(id, name) => { setTherapistId(id); setTherapistName(name); }} />
                            </div>
                        </div>
                    </div>

                    {/* Section 2 */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">2. Session Details</h4>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Session Duration</label>
                                <select className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 text-sm" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                                    <option value={30}>30 Mins</option>
                                    <option value={45}>45 Mins</option>
                                    <option value={60}>60 Mins</option>
                                    <option value={90}>90 Mins</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frequency</label>
                                <select className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 text-sm" value={frequency} onChange={e => setFrequency(e.target.value)}>
                                    <option>Weekly</option>
                                    <option>Bi-Weekly</option>
                                    <option>Monthly</option>
                                    <option>One-off</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assignment Reason (Optional)</label>
                            <input className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 text-sm" placeholder="e.g. Requested change due to scheduling..." value={reason} onChange={e => setReason(e.target.value)} />
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3 bg-slate-50 dark:bg-navy-950">
                    <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:bg-white rounded-xl transition-colors">Cancel</button>
                    <button onClick={handleSubmit} disabled={!clientId || !therapistId || loading} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg disabled:opacity-50">
                        {loading ? 'Processing...' : 'Confirm Pair'}
                    </button>
                </div>
            </div>
        </div>
    );
};
