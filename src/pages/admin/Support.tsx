
import React, { useState, useEffect } from 'react';
import { getSupportTickets, getClientFeedback, updateFeedbackStatus, getTicketMessages, sendTicketMessage, resolveSupportTicket, closeSupportTicket } from '../../services/dataService';
import { SupportTicket, SupportTicketMessage } from '../../types';

export const AdminSupport: React.FC = () => {
    const [viewMode, setViewMode] = useState<'tickets' | 'client-feedback'>('tickets');
    
    // Therapist Tickets
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [replyText, setReplyText] = useState('');
    const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
    const [sending, setSending] = useState(false);

    // Client Feedback
    const [feedbackItems, setFeedbackItems] = useState<any[]>([]);
    const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
    const [feedbackNote, setFeedbackNote] = useState('');

    // Filters
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterPriority, setFilterPriority] = useState('All');
    const [filterCategory, setFilterCategory] = useState('All');

    useEffect(() => {
        refreshData();
    }, [viewMode]);

    const filteredTickets = tickets.filter(t => {
        if (filterStatus !== 'All' && t.status !== filterStatus) return false;
        if (filterPriority !== 'All' && t.priority !== filterPriority) return false;
        if (filterCategory !== 'All' && t.type !== filterCategory) return false;
        return true;
    });

    const refreshData = () => {
        if (viewMode === 'tickets') {
            getSupportTickets().then(setTickets);
        } else {
            getClientFeedback().then(setFeedbackItems);
        }
    };

    const handleSelectTicket = async (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        const msgs = await getTicketMessages(ticket.id);
        setMessages(msgs);
    };

    const handleReply = async () => {
        if (!selectedTicket || !replyText.trim()) return;
        setSending(true);
        const success = await sendTicketMessage(selectedTicket.id, replyText, true);
        if (success) {
            const msgs = await getTicketMessages(selectedTicket.id);
            setMessages(msgs);
            setReplyText('');
            // update list
            const t = await getSupportTickets();
            setTickets(t);
            setSelectedTicket(t.find(x => x.id === selectedTicket.id) || selectedTicket);
        }
        setSending(false);
    };

    const handleResolve = async () => {
        if (!selectedTicket) return;
        await resolveSupportTicket(selectedTicket.id, replyText); // reply text is optional
        setReplyText('');
        const t = await getSupportTickets();
        setTickets(t);
        setSelectedTicket(t.find(x => x.id === selectedTicket.id) || selectedTicket);
    };

    const handleClose = async () => {
        if (!selectedTicket) return;
        await closeSupportTicket(selectedTicket.id);
        const t = await getSupportTickets();
        setTickets(t);
        setSelectedTicket(t.find(x => x.id === selectedTicket.id) || selectedTicket);
    };

    const handleFeedbackAction = async (status: string) => {
        if (!selectedFeedback) return;
        await updateFeedbackStatus(selectedFeedback.id, status, feedbackNote);
        setFeedbackItems(prev => prev.map(f => f.id === selectedFeedback.id ? { ...f, status: status, metadata: {...f.metadata, admin_note: feedbackNote} } : f));
        setSelectedFeedback(null);
        setFeedbackNote('');
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Help & Support Center</h1>
                <div className="flex bg-white dark:bg-navy-800 p-1 rounded-xl border border-slate-200 dark:border-navy-700">
                    <button 
                        onClick={() => setViewMode('tickets')} 
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'tickets' ? 'bg-slate-100 dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Tickets
                    </button>
                    <button 
                        onClick={() => setViewMode('client-feedback')} 
                        className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'client-feedback' ? 'bg-slate-100 dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Client Reports
                    </button>
                </div>
            </div>
            
            <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-700 overflow-hidden flex-1 relative flex flex-col">
                {viewMode === 'tickets' && (
                    <div className="p-4 border-b border-slate-100 dark:border-navy-700 flex gap-4 bg-slate-50/50 dark:bg-navy-900/50">
                        <select className="p-2 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="All">All Status</option>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Waiting for User">Waiting</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                        </select>
                        <select className="p-2 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg outline-none" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                            <option value="All">All Priority</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                        <select className="p-2 text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg outline-none" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                            <option value="All">All Categories</option>
                            <option value="Payment Issue">Payment Issue</option>
                            <option value="Booking Issue">Booking Issue</option>
                            <option value="Therapist Issue">Therapist Issue</option>
                            <option value="Technical Issue">Technical Issue</option>
                            <option value="Refund Request">Refund Request</option>
                            <option value="General Inquiry">General Inquiry</option>
                        </select>
                    </div>
                )}
                <div className="flex-1 overflow-auto">
                {viewMode === 'tickets' ? (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 font-bold uppercase text-xs sticky top-0">
                            <tr>
                                <th className="p-4">Ticket ID</th>
                                <th className="p-4">Subject</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Priority</th>
                                <th className="p-4">User</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                            {filteredTickets.map(ticket => (
                                <tr key={ticket.id} onClick={() => handleSelectTicket(ticket)} className="hover:bg-slate-50 dark:hover:bg-navy-700 cursor-pointer transition-colors">
                                    <td className="p-4 font-mono text-xs text-slate-500">{ticket.id.substring(0,8)}</td>
                                    <td className="p-4 font-bold text-slate-800 dark:text-white max-w-[200px] truncate">{ticket.subject}</td>
                                    <td className="p-4"><span className="bg-slate-100 dark:bg-navy-600 text-slate-600 dark:text-slate-300 px-2 py-1 rounded text-xs uppercase">{ticket.type}</span></td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${ticket.priority === 'High' ? 'bg-rose-100 text-rose-700' : ticket.priority === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{ticket.priority}</span>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-slate-800 dark:text-white truncate max-w-[150px]">{ticket.userName}</div>
                                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">{ticket.userEmail}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'bg-slate-200 text-slate-600' : ticket.status === 'Waiting for User' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                                            {ticket.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs whitespace-nowrap">{new Date(ticket.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))}
                            {filteredTickets.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-slate-400">No tickets found matching filters.</td></tr>}
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="p-4">Category</th>
                                <th className="p-4">Type</th>
                                <th className="p-4">Client</th>
                                <th className="p-4">Message Preview</th>
                                <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                            {feedbackItems.map(item => (
                                <tr key={item.id} onClick={() => setSelectedFeedback(item)} className="hover:bg-slate-50 dark:hover:bg-navy-700 cursor-pointer transition-colors">
                                    <td className="p-4 font-bold text-slate-800 dark:text-white">{item.category}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${item.type === 'Bug Report' ? 'bg-rose-100 text-rose-700' : item.type === 'Safety Alert' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'}`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-slate-800 dark:text-white">{item.userName}</div>
                                        <div className="text-xs text-slate-400">{item.userEmail}</div>
                                    </td>
                                    <td className="p-4 text-slate-600 dark:text-slate-300 max-w-xs truncate">{item.description}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${item.status === 'Resolved' || item.status === 'Fixed' ? 'bg-slate-200 text-slate-600' : 'bg-teal-100 text-teal-700'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {feedbackItems.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">No client reports found.</td></tr>}
                        </tbody>
                    </table>
                )}
                </div>
            </div>

            {/* Ticket Modal */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-navy-900 w-full max-w-3xl p-8 rounded-3xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-navy-800 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                                    {selectedTicket.subject}
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${selectedTicket.status === 'Resolved' || selectedTicket.status === 'Closed' ? 'bg-slate-200 text-slate-600' : 'bg-teal-100 text-teal-700'}`}>
                                        {selectedTicket.status}
                                    </span>
                                </h2>
                                <div className="text-sm text-slate-500 mt-1">From: {selectedTicket.userName} ({selectedTicket.userEmail}) • Priority: {selectedTicket.priority}</div>
                                {selectedTicket.imageUrl && (
                                    <a href={selectedTicket.imageUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 px-3 py-1 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg border border-slate-200 dark:border-navy-700 hover:bg-slate-200">
                                        📎 View Attachment
                                    </a>
                                )}
                            </div>
                            <button onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-4 bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-100 dark:border-navy-800">
                           {messages.map(msg => (
                                <div key={msg.id} className={`flex flex-col ${msg.sender_type === 'admin' ? 'items-end' : 'items-start'}`}>
                                    <div className="text-[10px] font-bold text-slate-400 mb-1 px-1">
                                        {msg.sender_name} • {new Date(msg.created_at).toLocaleString()}
                                    </div>
                                    <div className={`max-w-[80%] rounded-2xl p-4 text-sm whitespace-pre-wrap shadow-sm border ${
                                        msg.sender_type === 'admin' 
                                            ? 'bg-teal-600 text-white rounded-tr-none border-teal-700' 
                                            : 'bg-white dark:bg-navy-800 text-slate-800 dark:text-slate-200 rounded-tl-none border-slate-200 dark:border-navy-700'
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <div className="text-center text-sm py-10 opacity-50">No thread messages found.</div>
                            )}
                        </div>

                        {selectedTicket.status !== 'Resolved' && selectedTicket.status !== 'Closed' ? (
                            <div className="space-y-3">
                                <textarea 
                                    className="w-full p-4 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl outline-none text-sm resize-none h-24 focus:ring-2 focus:ring-teal-500"
                                    placeholder="Type admin reply..."
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                />
                                <div className="flex flex-wrap justify-end gap-3">
                                    <button onClick={handleClose} className="px-6 py-2 text-rose-500 bg-rose-50 font-bold hover:bg-rose-100 rounded-lg">Close Ticket</button>
                                    <button onClick={handleResolve} className="px-6 py-2 text-slate-700 bg-slate-200 font-bold hover:bg-slate-300 rounded-lg">Mark Resolved</button>
                                    <button onClick={handleReply} disabled={sending} className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 shadow-md">Reply to User</button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-slate-400 italic">This ticket is {selectedTicket.status.toLowerCase()}. Actions are disabled.</div>
                        )}
                    </div>
                </div>
            )}

            {/* Client Feedback Modal */}
            {selectedFeedback && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-navy-900 w-full max-w-2xl p-8 rounded-3xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-navy-800 pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    {selectedFeedback.category}
                                    <span className={`text-[10px] px-2 py-1 rounded-full uppercase ${selectedFeedback.type === 'Bug Report' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>{selectedFeedback.type}</span>
                                </h2>
                                <div className="text-sm text-slate-500 mt-1">From: {selectedFeedback.userName} ({selectedFeedback.userEmail})</div>
                            </div>
                            <button onClick={() => setSelectedFeedback(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto mb-6 space-y-4">
                            <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap">
                                {selectedFeedback.description}
                            </div>
                            
                            {selectedFeedback.metadata && (
                                <div className="p-4 border border-slate-100 dark:border-navy-700 rounded-xl text-xs text-slate-500 font-mono">
                                    <h4 className="font-bold mb-2 uppercase text-slate-400">System Metadata</h4>
                                    {Object.entries(selectedFeedback.metadata).map(([k, v]) => (
                                        <div key={k} className="flex justify-between border-b border-slate-50 dark:border-navy-800 py-1 last:border-0">
                                            <span>{k}:</span> <span className="text-slate-700 dark:text-slate-300">{String(v)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <textarea 
                                className="w-full p-4 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl outline-none text-sm resize-none h-24 focus:ring-2 focus:ring-indigo-500"
                                placeholder="Internal admin notes (optional)..."
                                value={feedbackNote}
                                onChange={e => setFeedbackNote(e.target.value)}
                            />
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setSelectedFeedback(null)} className="px-6 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancel</button>
                                <button onClick={() => handleFeedbackAction('Reviewed')} className="px-6 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300">Mark Reviewed</button>
                                <button onClick={() => handleFeedbackAction('Resolved')} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md">Mark Resolved</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
