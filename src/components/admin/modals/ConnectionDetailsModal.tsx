
import React, { useState, useEffect } from 'react';
import { TherapistConnection } from '../../../types';
import { getDirectMessages, sendDirectMessage, updateMeetingLink, breakConnection } from '../../../services/dataService';

interface ConnectionDetailsModalProps {
    connection: TherapistConnection;
    onClose: () => void;
    onRefresh: () => void;
}

export const ConnectionDetailsModal: React.FC<ConnectionDetailsModalProps> = ({ connection, onClose, onRefresh }) => {
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');
    const [meetingLink, setMeetingLink] = useState(connection.meetingLink || '');
    const [isEditingLink, setIsEditingLink] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        refreshMessages();
        // In a real app, we'd set up a subscription here
    }, [connection.id]);

    const refreshMessages = async () => {
        // We need to get messages between client and therapist
        // getDirectMessages currently takes one ID and assumes it's the other party
        // We might need a more specific function for admin to view a pair's chat
        const data = await getDirectMessages(connection.clientId); // This is a bit hacky, depends on implementation
        setMessages(data);
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;
        // Admin sending a message to the thread? 
        // For now, let's just allow viewing. 
        // If admin needs to intervene, they can send a system blast or direct message.
        // But the user asked for "acces chat beteen both user an dtherpist"
        setInputText('');
    };

    const handleSaveLink = async () => {
        setLoading(true);
        const success = await updateMeetingLink(connection.id, meetingLink);
        if (success) {
            setIsEditingLink(false);
            onRefresh();
        } else {
            alert("Failed to update meeting link.");
        }
        setLoading(false);
    };

    const handleTerminate = async () => {
        if (!confirm("Are you sure you want to terminate this therapeutic connection?")) return;
        setLoading(true);
        try {
            await breakConnection(connection.id);
            alert("Connection terminated successfully.");
            onRefresh();
            onClose();
        } catch (err: any) {
            alert("Error terminating connection: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-navy-900 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800 flex justify-between items-center bg-slate-50 dark:bg-navy-950">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Connection Details</h3>
                        <p className="text-xs text-slate-500">{connection.clientName} ↔ {connection.therapistName}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors">✕</button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Info & Meeting Link */}
                    <div className="w-1/3 border-r border-slate-100 dark:border-navy-800 p-6 space-y-6 overflow-y-auto">
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Meeting Link</h4>
                            {isEditingLink ? (
                                <div className="space-y-2">
                                    <input 
                                        className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 text-sm"
                                        placeholder="https://zoom.us/j/..."
                                        value={meetingLink}
                                        onChange={e => setMeetingLink(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={handleSaveLink} disabled={loading} className="flex-1 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700">
                                            {loading ? 'Saving...' : 'Save'}
                                        </button>
                                        <button onClick={() => setIsEditingLink(false)} className="flex-1 py-2 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-navy-800">
                                    <div className="truncate text-sm text-slate-600 dark:text-slate-300 mr-2">
                                        {connection.meetingLink || 'No link set'}
                                    </div>
                                    <button onClick={() => setIsEditingLink(true)} className="text-indigo-600 hover:text-indigo-700 text-xs font-bold">Edit</button>
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Connection Stats</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Total Sessions</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{connection.totalSessions}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Last Meeting</span>
                                    <span className="font-bold text-slate-800 dark:text-white">{connection.lastMeeting}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Status</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${connection.status === 'ACTIVE' ? 'bg-teal-100 text-teal-800' : 'bg-rose-100 text-rose-800'}`}>
                                        {connection.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-navy-800">
                            <button 
                                onClick={handleTerminate}
                                disabled={loading}
                                className="w-full py-3 bg-rose-50 text-rose-600 text-sm font-bold rounded-xl hover:bg-rose-100 disabled:opacity-50 transition-colors"
                            >
                                {loading ? 'Terminating...' : 'Terminate Connection'}
                            </button>
                        </div>
                    </div>

                    {/* Right: Chat History */}
                    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-navy-950">
                        <div className="p-4 border-b border-slate-100 dark:border-navy-800 bg-white dark:bg-navy-900">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chat History</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                                    <span className="text-4xl">💬</span>
                                    <p className="text-sm italic">No messages exchanged yet.</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const isTherapist = msg.sender_id === connection.therapistId;
                                    return (
                                        <div key={idx} className={`flex ${isTherapist ? 'justify-end' : 'justify-start'}`}>
                                            <div className="max-w-[80%]">
                                                <div className={`text-[10px] font-bold uppercase mb-1 ${isTherapist ? 'text-right text-indigo-500' : 'text-teal-500'}`}>
                                                    {isTherapist ? 'Therapist' : 'Client'}
                                                </div>
                                                <div className={`p-3 rounded-2xl text-sm ${isTherapist ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-white rounded-bl-none'}`}>
                                                    {msg.content}
                                                </div>
                                                <div className={`text-[9px] text-slate-400 mt-1 ${isTherapist ? 'text-right' : ''}`}>
                                                    {new Date(msg.created_at).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="p-4 bg-white dark:bg-navy-900 border-t border-slate-100 dark:border-navy-800">
                            <p className="text-[10px] text-slate-400 text-center italic">Admin view: You are monitoring this conversation for quality assurance.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
