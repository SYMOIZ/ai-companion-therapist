
import React, { useState, useEffect } from 'react';
import { TeamRole } from '../../../types';

interface AddTeamModalProps {
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
}

export const AddTeamModal: React.FC<AddTeamModalProps> = ({ onClose, onSubmit }) => {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'Viewer' as TeamRole,
        isActive: true,
        timePeriod: 'permanent', // permanent, 7days, 30days, custom
        customDate: '',
    });

    // Auto-generate password on mount
    useEffect(() => {
        generatePassword();
    }, []);

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
        let pass = "";
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData(prev => ({ ...prev, password: pass }));
    };

    const calculateExpiry = (): string | null => {
        const now = new Date();
        if (formData.timePeriod === 'permanent') return null;
        if (formData.timePeriod === '7days') return new Date(now.setDate(now.getDate() + 7)).toISOString();
        if (formData.timePeriod === '30days') return new Date(now.setDate(now.getDate() + 30)).toISOString();
        if (formData.timePeriod === 'custom' && formData.customDate) return new Date(formData.customDate).toISOString();
        return null;
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        const expiryDate = calculateExpiry();
        
        await onSubmit({
            ...formData,
            access_expires_at: expiryDate
        });
        setIsLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-navy-800 flex justify-between items-center bg-slate-50 dark:bg-navy-950">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Add Team Member</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-rose-500 transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-6">
                    
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                            <input 
                                className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 text-sm focus:ring-2 focus:ring-teal-500"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="e.g. Ali Khan"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email / Login ID</label>
                            <input 
                                className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 text-sm focus:ring-2 focus:ring-teal-500"
                                value={formData.email}
                                onChange={e => setFormData({...formData, email: e.target.value})}
                                placeholder="staff@sukoon.ai"
                            />
                        </div>
                    </div>

                    {/* Credentials */}
                    <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-200 dark:border-navy-800">
                        <div className="flex justify-between items-end mb-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Initial Password</label>
                            <button onClick={generatePassword} className="text-[10px] text-teal-600 font-bold hover:underline">Auto-Generate</button>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                className="w-full p-2 bg-white dark:bg-navy-900 rounded-lg outline-none border border-slate-200 dark:border-navy-700 text-sm font-mono tracking-wide"
                                value={formData.password}
                                onChange={e => setFormData({...formData, password: e.target.value})}
                            />
                            <button 
                                onClick={() => navigator.clipboard.writeText(formData.password)}
                                className="px-3 py-2 bg-slate-200 dark:bg-navy-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-300"
                                title="Copy"
                            >
                                📋
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                            ⚠️ Note: Copy these credentials now. You cannot view the password again after creation.
                        </p>
                    </div>

                    {/* Access Controls */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role & Rights</label>
                            <select 
                                className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 text-sm"
                                value={formData.role}
                                onChange={e => setFormData({...formData, role: e.target.value as TeamRole})}
                            >
                                <option value="Viewer">Viewer (Read Only)</option>
                                <option value="Moderator">Moderator</option>
                                <option value="Accountant">Accountant</option>
                                <option value="Super Admin">Super Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                            <button 
                                onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                                className={`w-full p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${formData.isActive ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                            >
                                <div className={`w-3 h-3 rounded-full ${formData.isActive ? 'bg-teal-500' : 'bg-slate-300'}`}></div>
                                {formData.isActive ? 'Active' : 'Inactive'}
                            </button>
                        </div>
                    </div>

                    {/* Time Period */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Access Period</label>
                        <div className="grid grid-cols-4 gap-2 mb-2">
                            {['permanent', '7days', '30days', 'custom'].map((tp) => (
                                <button
                                    key={tp}
                                    onClick={() => setFormData({...formData, timePeriod: tp})}
                                    className={`py-2 text-xs font-bold rounded-lg border transition-all capitalize ${
                                        formData.timePeriod === tp 
                                        ? 'bg-slate-800 text-white border-slate-800' 
                                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    {tp === 'permanent' ? '∞ Forever' : tp.replace('days', ' Days')}
                                </button>
                            ))}
                        </div>
                        {formData.timePeriod === 'custom' && (
                            <input 
                                type="date"
                                className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800 text-sm"
                                value={formData.customDate}
                                onChange={e => setFormData({...formData, customDate: e.target.value})}
                            />
                        )}
                        {formData.timePeriod !== 'permanent' && (
                            <div className="flex items-center gap-2 mt-2 text-amber-600 text-xs font-medium bg-amber-50 p-2 rounded-lg border border-amber-100">
                                <span>🕒</span> Access will be automatically revoked after the selected period.
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-navy-800 flex justify-end gap-3 bg-slate-50 dark:bg-navy-950">
                    <button onClick={onClose} className="px-6 py-3 text-slate-500 font-bold hover:bg-white rounded-xl transition-colors">Cancel</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={isLoading || (!formData.name || !formData.email)}
                        className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg disabled:opacity-50 disabled:shadow-none"
                    >
                        {isLoading ? 'Creating...' : 'Create Member'}
                    </button>
                </div>
            </div>
        </div>
    );
};
