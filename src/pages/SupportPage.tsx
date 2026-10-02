import React, { useState, useEffect } from 'react';
import { SupportTicket, SupportTicketMessage } from '../types';
import { getUserSupportTickets, saveSupportTicket, getTicketMessages, sendTicketMessage } from '../services/dataService';

export const SupportPage: React.FC = () => {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    const [ticketData, setTicketData] = useState({ type: 'General Inquiry', priority: 'Medium', subject: '', description: '', imageUrl: '' });
    
    // Chat inside ticket
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        const fetchTickets = async () => {
            setIsLoading(true);
            const data = await getUserSupportTickets();
            setTickets(data);
            setIsLoading(false);
        };
        fetchTickets();
    }, []);

    const handleSelectTicket = async (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        const msgs = await getTicketMessages(ticket.id);
        setMessages(msgs);
    };

    const handleReply = async () => {
        if (!replyText.trim() || !selectedTicket) return;
        setSending(true);
        const success = await sendTicketMessage(selectedTicket.id, replyText, false);
        if (success) {
            const msgs = await getTicketMessages(selectedTicket.id);
            setMessages(msgs);
            setReplyText('');
            // update ticket list status
            const data = await getUserSupportTickets();
            setTickets(data);
            setSelectedTicket(data.find(t => t.id === selectedTicket.id) || selectedTicket);
        }
        setSending(false);
    };

    const handleSubmitTicket = async () => {
        if (!ticketData.subject || !ticketData.description) return;
        const newTicket: SupportTicket = {
            id: crypto.randomUUID(),
            userId: '', // handled by backend
            type: ticketData.type as any,
            priority: ticketData.priority as any,
            subject: ticketData.subject,
            description: ticketData.description,
            imageUrl: ticketData.imageUrl,
            status: 'Open',
            timestamp: Date.now(),
            created_at: new Date().toISOString()
        };
        await saveSupportTicket(newTicket);
        setShowCreateModal(false);
        setTicketData({ type: 'General Inquiry', priority: 'Medium', subject: '', description: '', imageUrl: '' });
        alert("Ticket Submitted Successfully!");
        
        const data = await getUserSupportTickets();
        setTickets(data);
    };

    return (
        <div className="p-6 md:p-12 overflow-y-auto h-full max-w-5xl mx-auto flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-sans font-bold text-slate-800 dark:text-white mb-2">Help & Support</h1>
                    <p className="text-slate-500 dark:text-slate-400">View your support tickets or submit a new request.</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="px-6 py-3 bg-slate-900 dark:bg-teal-600 text-white font-bold rounded-xl hover:opacity-90 shadow-lg"
                >
                    + New Ticket
                </button>
            </div>

            {isLoading ? (
                  <div className="space-y-4 py-10 animate-pulse">
                      {[1, 2, 3].map((i) => (
                          <div key={i} className="h-20 bg-slate-100 dark:bg-navy-800/60 border border-slate-200 dark:border-navy-700/50 rounded-2xl w-full" />
                      ))}
                  </div>
            ) : selectedTicket ? (
                // Chat Thread View
                <div className="bg-white dark:bg-navy-800 rounded-3xl shadow-sm border border-slate-200 dark:border-navy-700 p-6 flex flex-col h-[600px]">
                    <div className="flex justify-between items-center mb-6 border-b pb-4 dark:border-navy-700">
                        <div>
                            <button onClick={() => setSelectedTicket(null)} className="text-sm font-bold opacity-70 hover:opacity-100 mb-2">← Back to Tickets</button>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                {selectedTicket.subject}
                                <span className={`px-3 py-1 rounded-full text-xs uppercase ${
                                    selectedTicket.status === 'Resolved' ? 'bg-teal-100 text-teal-700' :
                                    selectedTicket.status === 'Closed' ? 'bg-slate-200 text-slate-600' :
                                    selectedTicket.status === 'Waiting for User' ? 'bg-rose-100 text-rose-700' :
                                    'bg-indigo-100 text-indigo-700'
                                }`}>
                                    {selectedTicket.status}
                                </span>
                            </h2>
                            <p className="text-sm opacity-70 mt-1">Ticket #{selectedTicket.id.substring(0,8)} • {selectedTicket.type} • Priority: {selectedTicket.priority}</p>
                            {selectedTicket.imageUrl && (
                                <a href={selectedTicket.imageUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 px-3 py-1 bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-200">
                                    📎 View Attachment
                                </a>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex flex-col ${msg.sender_type === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className="text-[10px] font-bold text-slate-400 mb-1 px-1">
                                    {msg.sender_name} • {new Date(msg.created_at).toLocaleString()}
                                </div>
                                <div className={`max-w-[80%] rounded-2xl p-4 text-sm whitespace-pre-wrap ${
                                    msg.sender_type === 'user' 
                                        ? 'bg-slate-900 text-white rounded-tr-none dark:bg-teal-600' 
                                        : 'bg-slate-100 text-slate-800 rounded-tl-none dark:bg-navy-700 dark:text-slate-200'
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {messages.length === 0 && (
                            <div className="text-center text-sm py-10 opacity-50">No messages yet.</div>
                        )}
                    </div>
                    
                    {(selectedTicket.status !== 'Closed' && selectedTicket.status !== 'Resolved') && (
                        <div className="flex gap-2">
                            <textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder="Type your reply..."
                                className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-navy-600 p-3 bg-slate-50 dark:bg-navy-900 dark:text-white outline-none"
                                rows={2}
                            />
                            <button 
                                onClick={handleReply}
                                disabled={sending || !replyText.trim()}
                                className="px-6 rounded-xl bg-slate-900 dark:bg-teal-600 text-white font-bold disabled:opacity-50"
                            >
                                Send
                            </button>
                        </div>
                    )}
                    {(selectedTicket.status === 'Closed' || selectedTicket.status === 'Resolved') && (
                        <div className="text-center p-4 bg-slate-50 dark:bg-navy-900 rounded-xl text-sm opacity-70 font-bold">
                            This ticket is marked as {selectedTicket.status}. Replies are disabled.
                        </div>
                    )}
                </div>
            ) : (
                // Ticket List View
                <div className="bg-white dark:bg-navy-800 rounded-3xl shadow-sm border border-slate-200 dark:border-navy-700 overflow-hidden">
                    {tickets.length > 0 ? (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-navy-900 border-b border-slate-100 dark:border-navy-700 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <th className="p-4">ID</th>
                                            <th className="p-4">Subject</th>
                                            <th className="p-4 hidden md:table-cell">Category</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 hidden md:table-cell">Created</th>
                                            <th className="p-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tickets.map(t => (
                                            <tr key={t.id} className="border-b border-slate-50 dark:border-navy-700/50 hover:bg-slate-50 dark:hover:bg-navy-900/50">
                                                <td className="p-4 font-mono text-xs">{t.id.substring(0,8)}</td>
                                                <td className="p-4 font-bold max-w-[200px] truncate">{t.subject}</td>
                                                <td className="p-4 hidden md:table-cell text-sm opacity-75">{t.type}</td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs uppercase font-bold ${
                                                        t.status === 'Resolved' ? 'bg-teal-100 text-teal-700' :
                                                        t.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                                                        t.status === 'Waiting for User' ? 'bg-rose-100 text-rose-700' :
                                                        'bg-indigo-100 text-indigo-700'
                                                    }`}>
                                                        {t.status}
                                                    </span>
                                                </td>
                                                <td className="p-4 hidden md:table-cell text-xs opacity-75">{new Date(t.created_at).toLocaleDateString()}</td>
                                                <td className="p-4 text-right">
                                                    <button 
                                                        onClick={() => handleSelectTicket(t)}
                                                        className="text-xs font-bold text-teal-600 hover:text-teal-800 dark:hover:text-teal-300"
                                                    >
                                                        View Thread
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card-based List View */}
                            <div className="block md:hidden space-y-4 p-4 dark:bg-navy-900/40">
                                {tickets.map(t => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => handleSelectTicket(t)}
                                        className="p-5 bg-slate-50 dark:bg-navy-900/50 border border-slate-200/60 dark:border-navy-700 rounded-2xl flex flex-col space-y-3 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-navy-800/60 transition-all active:scale-[0.99] shadow-sm"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-mono text-[10px] bg-slate-200 dark:bg-navy-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">#{t.id.substring(0,8)}</span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                                                t.status === 'Resolved' ? 'bg-teal-100 text-teal-700' :
                                                t.status === 'Closed' ? 'bg-slate-100 text-slate-600' :
                                                t.status === 'Waiting for User' ? 'bg-rose-100 text-rose-700' :
                                                'bg-indigo-100 text-indigo-700'
                                            }`}>
                                                {t.status}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-white text-base leading-snug">{t.subject}</h3>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t.type} • {new Date(t.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex justify-end pt-1">
                                            <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">View Thread &rarr;</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-16 text-slate-500">
                           <div className="text-4xl mb-4">🎟️</div>
                           <p>You haven't submitted any support tickets.</p>
                        </div>
                    )}
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 h-full">
                    <div className="bg-white dark:bg-navy-800 w-full max-w-md p-8 rounded-3xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Create Ticket</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Issue Category</label>
                                <select 
                                    className="w-full p-3 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-600 outline-none text-slate-800 dark:text-white"
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
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${(ticketData as any).priority === p ? 'bg-slate-800 dark:bg-teal-600 text-white' : 'bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-400'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                <input 
                                    className="w-full p-3 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-600 outline-none text-slate-800 dark:text-white"
                                    placeholder="Brief title..."
                                    value={ticketData.subject}
                                    onChange={e => setTicketData({...ticketData, subject: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                                <textarea 
                                    className="w-full p-3 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-600 outline-none h-32 resize-none text-slate-800 dark:text-white"
                                    placeholder="Please describe the issue in detail..."
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
                                    className="w-full p-3 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-600 rounded-xl text-sm"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-navy-700 rounded-xl">Cancel</button>
                            <button onClick={handleSubmitTicket} className="flex-1 py-3 bg-slate-900 dark:bg-teal-600 text-white font-bold rounded-xl shadow-lg">Submit Ticket</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};