
import React, { useState, useEffect } from 'react';
import { sendBroadcast, getBroadcastHistory } from '../../services/dataService';
import { Broadcast, BroadcastType, BroadcastAudience } from '../../types';

export const AdminBroadcast: React.FC = () => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<BroadcastType>('info');
    const [audience, setAudience] = useState<BroadcastAudience>('all');
    const [history, setHistory] = useState<Broadcast[]>([]);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = () => {
        getBroadcastHistory().then(setHistory);
    };

    const handleSend = async () => {
        if (!title || !message) {
            alert("Please provide title and message.");
            return;
        }
        setSending(true);
        const success = await sendBroadcast(title, message, type, audience);
        setSending(false);
        
        if (success) {
            alert("Broadcast Blast Sent! 🚀");
            setTitle('');
            setMessage('');
            loadHistory();
        } else {
            alert("Failed to send broadcast. Check logs.");
        }
    };

    const getTypeColor = (t: BroadcastType) => {
        switch(t) {
            case 'info': return 'bg-blue-100 text-blue-700';
            case 'warning': return 'bg-amber-100 text-amber-700';
            case 'critical': return 'bg-rose-100 text-rose-700';
            case 'marketing': return 'bg-purple-100 text-purple-700';
            case 'sales': return 'bg-emerald-100 text-emerald-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const getTypeIcon = (t: BroadcastType) => {
        switch(t) {
            case 'info': return 'ℹ️';
            case 'warning': return '⚠️';
            case 'critical': return '🚨';
            case 'marketing': return '📢';
            case 'sales': return '💰';
            default: return '📢';
        }
    };

    return (
        <div className="space-y-8 animate-fade-in h-full flex flex-col">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Broadcast Center</h1>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Composer Form */}
                <div className="md:col-span-1 bg-white dark:bg-navy-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-700 h-fit">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Compose Blast</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                            <input 
                                className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800"
                                placeholder="e.g. System Maintenance"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800"
                                    value={type}
                                    onChange={e => setType(e.target.value as BroadcastType)} >
                                    <option value="info">Info ℹ️</option>
                                    <option value="warning">Warning ⚠️</option>
                                    <option value="critical">Critical 🚨</option>
                                    <option value="marketing">Marketing 📢</option>
                                    <option value="sales">Sales 💰</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Audience</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800"
                                    value={audience}
                                    onChange={e => setAudience(e.target.value as BroadcastAudience)} >
                                    <option value="all">All Users</option>
                                    <option value="therapists">Therapists Only</option>
                                    <option value="clients">Clients Only</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Message Body</label>
                            <textarea 
                                className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 h-32 resize-none"
                                placeholder="Write your message here..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                        </div>

                        <button 
                            onClick={handleSend}
                            disabled={sending}
                            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2" >
                            {sending ? 'Sending...' : '🚀 Send Blast'}
                        </button>
                    </div>
                </div>

                {/* History Table */}
                <div className="md:col-span-2 bg-white dark:bg-navy-800 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-700 overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-navy-800">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Broadcast History</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Title / Message</th>
                                    <th className="p-4">Target</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                                {history.map(b => (
                                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                                        <td className="p-4 text-slate-500 text-xs font-mono">{new Date(b.sentAt).toLocaleDateString()}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${getTypeColor(b.type)}`}>
                                                {getTypeIcon(b.type)} {b.type}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-slate-800 dark:text-white">{b.title}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-xs">{b.message}</div>
                                        </td>
                                        <td className="p-4 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{b.audience}</td>
                                    </tr>
                                ))}
                                {history.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">No broadcasts yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
