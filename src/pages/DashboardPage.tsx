import React from 'react';
import { UserSettings } from '../types';
import { redirectClientDemoToSignup } from '../lib/clientDemo';
import { MessageSquare, LayoutDashboard, Calendar, Search } from 'lucide-react';

interface DashboardProps {
    settings: UserSettings;
    onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardProps> = ({ settings, onNavigate }) => {
    return (
        <div className="h-full w-full overflow-y-auto bg-slate-50 dark:bg-navy-950 p-6 md:p-10 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                
                <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-navy-800">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Welcome back, {settings.name}!</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Here is a quick overview of your wellness journey today.</p>
                    </div>
                    <div className="hidden md:block">
                        <div className="bg-teal-50 dark:bg-navy-900 border border-teal-200 dark:border-navy-800 text-teal-700 dark:text-teal-400 px-4 py-2 rounded-full font-medium text-sm">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-100 dark:border-navy-800 hover:shadow-md cursor-pointer transition-shadow" onClick={() => onNavigate('chat')}>
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                            <MessageSquare size={20} />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Sukoon AI Chat</h3>
                        <p className="text-sm text-slate-500 mt-1">Start a new conversation and release your thoughts.</p>
                    </div>

                    <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-100 dark:border-navy-800 hover:shadow-md cursor-pointer transition-shadow" onClick={() => onNavigate('journal')}>
                        <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
                            <Calendar size={20} />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Mood Tracking</h3>
                        <p className="text-sm text-slate-500 mt-1">Log your feelings and track your wellness over time.</p>
                    </div>

                    <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-100 dark:border-navy-800 hover:shadow-md cursor-pointer transition-shadow" onClick={() => onNavigate('directory')}>
                        <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4">
                            <Search size={20} />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">Find a Therapist</h3>
                        <p className="text-sm text-slate-500 mt-1">Connect with professional therapists in the directory.</p>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-lavender-500 to-indigo-600 rounded-3xl p-8 text-white flex flex-col md:flex-row justify-between items-center mt-6 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold">Try Sukoon Premium</h2>
                        <p className="text-white/80 mt-2 text-sm max-w-sm">Unlock advanced insights, memory context, and priority support for the best possible experience.</p>
                    </div>
                    <button onClick={() => { if (redirectClientDemoToSignup(settings)) return; onNavigate('plans'); }} className="mt-4 md:mt-0 px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl text-sm hover:bg-slate-50 transition-colors shrink-0">
                        View Plans
                    </button>
                </div>

            </div>
        </div>
    );
};
