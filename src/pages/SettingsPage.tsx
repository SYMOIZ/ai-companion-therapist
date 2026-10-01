import React, { useState, useEffect } from 'react';
import { UserSettings, TherapistStyle, PersonalityMode, Gender, Profession, TonePreference, Language } from '../types';
import { deleteTodayData, deleteAllData, deleteDateData } from '../services/ragService';
import { checkConnection } from '../services/dataService';
import { ShieldCheck, User, Bell, Lock, Globe, Database, Trash2 } from 'lucide-react';
import { isClientDemoAccount } from '../lib/clientDemo';

interface SettingsPageProps {
  settings: UserSettings;
  onUpdateSettings: (s: UserSettings) => void;
}

const LANGUAGES: Language[] = ['English', 'Urdu', 'Roman Urdu', 'Sindhi', 'Pashto', 'Siraiki', 'Arabic', 'Spanish'];
const TONES: TonePreference[] = ['Cute', 'Mature', 'Friendly', 'Soft', 'Calm', 'Direct'];

export const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onUpdateSettings }) => {
  const [deleteDate, setDeleteDate] = useState('');
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    checkConnection().then(res => setDbStatus(res.status));
  }, []);

  const handleDeleteDate = () => {
    if (deleteDate) {
      deleteDateData(settings.id, deleteDate);
      alert(`Data from ${deleteDate} cleared.`);
      setDeleteDate('');
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-navy-950 overflow-y-auto font-sans">
      <div className="max-w-4xl mx-auto py-8 text-slate-800 dark:text-white px-4 md:px-8">
        
        <header className="mb-8 border-b border-slate-200 dark:border-navy-800 pb-6 flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account preferences and app settings.</p>
            </div>
            <div className={`w-3 h-3 rounded-full ${dbStatus === 'connected' ? 'bg-teal-500 animate-pulse' : dbStatus === 'error' ? 'bg-rose-500' : 'bg-amber-500'}`} title={dbStatus === 'connected' ? 'System Online' : 'Check connection'}></div>
        </header>

        <div className="space-y-8 pb-12">
          
          {/* Profile Information */}
          <section className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-navy-800 flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <User size={18} />
               </div>
               <h2 className="text-lg font-semibold">Profile Information</h2>
               {isClientDemoAccount(settings) && <p className="text-xs text-amber-700 font-semibold">Demo Account. Preferences stay in this session only.</p>}
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Display Name</label>
                   <input type="text" value={settings.name || ''} readOnly className="w-full px-4 py-2.5 bg-slate-100 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700 rounded-xl outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed"/>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Email Address</label>
                   <input type="email" value={settings.email || ''} readOnly className="w-full px-4 py-2.5 bg-slate-100 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700 rounded-xl outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed" />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Age</label>
                   <input type="number" value={settings.age || ''} readOnly className="w-full px-4 py-2.5 bg-slate-100 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700 rounded-xl outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Gender</label>
                    <input type="text" value={settings.gender || ''} readOnly className="w-full px-4 py-2.5 bg-slate-100 dark:bg-navy-800/50 border border-slate-200 dark:border-navy-700 rounded-xl outline-none text-slate-500 dark:text-slate-400 cursor-not-allowed"/>
                </div>
            </div>
          </section>

          {/* Preferences & Language */}
          <section className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-navy-800 flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <Globe size={18} />
               </div>
               <h2 className="text-lg font-semibold">Preferences</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Language</label>
                    <select 
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl outline-none text-slate-800 dark:text-white focus:border-teal-500"
                        value={settings.preferredLanguage}
                        onChange={e => onUpdateSettings({...settings, preferredLanguage: e.target.value as Language})}
                    >
                        {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Tone Preference</label>
                     <select 
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl outline-none text-slate-800 dark:text-white focus:border-teal-500"
                        value={settings.tonePreference}
                        onChange={e => onUpdateSettings({...settings, tonePreference: e.target.value as TonePreference})}
                    >
                        {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>
          </section>

          {/* Privacy & Memory */}
          <section className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-navy-800 flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Database size={18} />
               </div>
               <h2 className="text-lg font-semibold">Privacy Controls & Memory</h2>
            </div>
            <div className="p-6 space-y-6">
                
                <div className="flex items-center justify-between">
                    <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">Context Memory</div>
                        <div className="text-sm text-slate-500">Allow Sukoon to remember past context.</div>
                    </div>
                    <div 
                        onClick={() => onUpdateSettings({...settings, memoryEnabled: !settings.memoryEnabled})}
                        className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${settings.memoryEnabled ? 'bg-teal-500' : 'bg-slate-300 dark:bg-navy-700'}`}
                    >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.memoryEnabled ? 'translate-x-6' : ''}`} />
                    </div>
                </div>

                <hr className="border-slate-100 dark:border-navy-800"/>

                <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Data Management</h3>
                    <div className="space-y-4 max-w-xl">
                        <button 
                            onClick={() => { deleteTodayData(settings.id); alert("Today's data deleted."); }}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
                        >
                            <span>Clear Today's Conversation</span>
                            <Trash2 size={16} className="text-slate-400"/>
                        </button>
                        
                        <div className="flex gap-2">
                            <input 
                                type="date" 
                                value={deleteDate}
                                onChange={e => setDeleteDate(e.target.value)}
                                className="flex-1 px-4 py-3 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 outline-none text-sm text-slate-700 dark:text-white"
                            />
                            <button 
                                onClick={handleDeleteDate}
                                disabled={!deleteDate}
                                className="px-6 py-3 bg-slate-800 dark:bg-slate-700 rounded-xl text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                            >
                                Delete Date
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          </section>

          {/* Security */}
          <section className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-navy-800 flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Lock size={18} />
               </div>
               <h2 className="text-lg font-semibold">Security</h2>
            </div>
            <div className="p-6">
                {!isClientDemoAccount(settings) && (
                <button 
                    onClick={() => {
                        if(confirm("Are you sure? This will delete ALL journals, memories, and sessions for your account. This action cannot be undone.")) {
                            deleteAllData(settings.id);
                            window.location.reload();
                        }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 bg-rose-50 dark:bg-rose-900/10 hover:bg-rose-100 dark:hover:bg-rose-900/20 text-sm font-bold transition-colors"
                >
                    <Trash2 size={16} />
                    Delete Account & All Data
                </button>
                )}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

