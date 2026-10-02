
import React, { useEffect, useState } from 'react';
import { getUserNotifications, markAllNotificationsRead } from '../services/dataService';
import { Notification } from '../types';
import { CLIENT_DEMO_USER_ID } from '../lib/clientDemo';

export const NotificationsPage: React.FC<{userId?: string, role?: string, onNavigate?: (t: string) => void}> = ({ userId, role, onNavigate }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        load();
    }, [userId]);

    const load = () => {
        if (userId === CLIENT_DEMO_USER_ID) {
            setNotifications([]);
            setLoading(false);
            return;
        }
        getUserNotifications().then(async data => {
            const hasUnread = data.some(n => !n.isRead);
            setNotifications(data.map(n => ({...n, isRead: true})));
            setLoading(false);
            if (hasUnread && userId) {
                await markAllNotificationsRead(userId);
            }
        });
    };

    const handleRead = (n: Notification) => {
        if (!onNavigate || !role) return;
        const t = n.title.toLowerCase();
        let route = 'notifications';
        
        if (role === 'admin') {
             if (t.includes('therapist') && (t.includes('application') || t.includes('setup'))) route = 'admin-therapists';
             else if (t.includes('payment') || t.includes('deposit') || t.includes('boost')) route = 'admin-finance';
             else route = 'admin-support';
        } else if (role === 'therapist') {
             if (t.includes('booking request') || t.includes('booking')) route = 'therapist-calendar';
             else if (t.includes('reschedule')) route = 'therapist-calendar';
             else if (t.includes('message')) route = 'therapist-patients';
             else if (t.includes('admin') || t.includes('system')) route = 'therapist-support';
             else route = 'notifications';
        } else {
             if (t.includes('booking approved') || t.includes('booking rejected') || t.includes('reschedule')) route = 'journal';
             else if (t.includes('message')) route = 'chat';
             else if (t.includes('admin') || t.includes('support')) route = 'support';
             else route = 'notifications';
        }
        
        onNavigate(route);
    };

    const getStyles = (type: string) => {
        switch(type) {
            case 'critical': 
                return 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-100';
            case 'warning':
                return 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100';
            case 'marketing':
            case 'sales':
                return 'bg-gradient-to-r from-purple-50 to-indigo-50 border-indigo-200 text-indigo-900 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-indigo-800 dark:text-indigo-100';
            default: // info
                return 'bg-white border-slate-100 text-slate-800 dark:bg-navy-800 dark:border-navy-700 dark:text-white';
        }
    };

    const getIcon = (type: string) => {
        switch(type) {
            case 'critical': return '🚨';
            case 'warning': return '⚠️';
            case 'marketing': return '🎉';
            case 'sales': return '💰';
            default: return 'ℹ️';
        }
    };

    return (
        <div className="p-6 md:p-12 overflow-y-auto h-full max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-8 flex items-center gap-3">
                <span>🔔</span> Notifications
            </h1>

            {loading ? (
                <div className="space-y-4 py-8 animate-pulse">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-750 rounded-2xl w-full" />
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {notifications.length === 0 && (
                        <div className="text-center text-slate-400 py-12 italic bg-slate-50 dark:bg-navy-900 rounded-3xl">
                            All caught up! No new notifications.
                        </div>
                    )}

                    {notifications.map(n => (
                        <div 
                            key={n.id} 
                            onClick={() => handleRead(n)}
                            className={`p-6 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${getStyles(n.type)} ${!n.isRead ? 'shadow-md ring-2 ring-offset-2 ring-teal-400 dark:ring-offset-navy-900' : 'opacity-75 hover:opacity-100'}`}
                        >
                            {!n.isRead && (
                                <div className="absolute top-4 right-4 w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-sm"></div>
                            )}
                            
                            <div className="flex gap-4">
                                <div className="text-3xl shrink-0 mt-1">{getIcon(n.type)}</div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-lg">{n.title}</h3>
                                        <span className="text-xs font-mono opacity-60 ml-4">{new Date(n.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-sm opacity-90 leading-relaxed whitespace-pre-wrap">{n.message}</p>
                                    
                                    {(n.type === 'marketing' || n.type === 'sales') && (
                                        <div className="mt-4 inline-block px-4 py-2 bg-white/50 dark:bg-black/20 rounded-lg text-xs font-bold uppercase tracking-wider">
                                            Special Offer
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
