
import React, { useState, useEffect } from 'react';
import { getTherapists, getDirectMessages, sendDirectMessage } from '../../services/dataService';
import { Therapist } from '../../types';
import { supabase } from '../../services/supabaseClient';

export const AdminMessages: React.FC = () => {
    const [therapists, setTherapists] = useState<Therapist[]>([]);
    const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState('');

    useEffect(() => {
        getTherapists().then(setTherapists);
    }, []);

    useEffect(() => {
        if (selectedTherapist) {
            getDirectMessages(selectedTherapist.id).then(setMessages);
            // Real-time would go here with supabase.channel
        }
    }, [selectedTherapist]);

    const handleSend = async () => {
        if (!selectedTherapist || !inputText.trim()) return;
        
        await sendDirectMessage(selectedTherapist.id, inputText);
        
        // Optimistic Update
        setMessages(prev => [...prev, {
            id: 'temp-' + Date.now(),
            sender_id: 'me', // handled by comparison in render
            content: inputText,
            created_at: new Date().toISOString()
        }]);
        setInputText('');
    };

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white dark:bg-navy-800 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-700 overflow-hidden animate-fade-in">
            {/* Left: List */}
            <div className="w-80 border-r border-slate-100 dark:border-navy-700 flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-navy-700">
                    <input className="w-full p-2 bg-slate-50 dark:bg-navy-950 rounded-lg text-sm outline-none" placeholder="Search therapists..." />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {therapists.map(t => (
                        <div 
                            key={t.id} 
                            onClick={() => setSelectedTherapist(t)}
                            className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors ${selectedTherapist?.id === t.id ? 'bg-slate-50 dark:bg-navy-900 border-l-4 border-teal-500' : ''}`}
                        >
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center font-bold text-slate-500">{t.name[0]}</div>
                            <div>
                                <div className="font-bold text-sm text-slate-800 dark:text-white">{t.name}</div>
                                <div className="text-xs text-slate-400 truncate w-40">Click to chat</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Chat */}
            <div className="flex-1 flex flex-col bg-slate-50 dark:bg-navy-950">
                {selectedTherapist ? (
                    <>
                        <div className="p-4 bg-white dark:bg-navy-800 border-b border-slate-100 dark:border-navy-700 flex items-center justify-between">
                            <div className="font-bold text-slate-800 dark:text-white">{selectedTherapist.name} <span className="text-xs font-normal text-slate-400 ml-2">● Online</span></div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, idx) => {
                                const isMe = msg.sender_id === 'me' || msg.sender_id === (supabase.auth.getUser() as any)?.id; // Simplified check
                                return (
                                    <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] p-3 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-800 dark:text-white rounded-bl-none'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 bg-white dark:bg-navy-800 border-t border-slate-100 dark:border-navy-700 flex gap-2">
                            <input 
                                className="flex-1 p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none text-sm"
                                placeholder="Type a message..."
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                            />
                            <button onClick={handleSend} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">Select a conversation to start chatting</div>
                )}
            </div>
        </div>
    );
};