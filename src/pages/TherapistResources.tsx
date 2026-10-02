
import React, { useState, useEffect } from 'react';
import { reportSafetyIncident, getTherapistPatients } from '../services/dataService';
import { SafetyIncident, AdminUserView, TherapistConnection } from '../types';

// --- Static Pages ---

export const CodeOfConductPage: React.FC = () => (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl border border-slate-100 shadow-sm font-sans text-slate-800">
        <h1 className="text-3xl font-bold mb-2">Code of Conduct & Ethics</h1>
        <p className="text-sm font-bold text-teal-600 mb-8 uppercase tracking-wider">The Healer's Pledge</p>
        
        <p className="mb-6 text-slate-600 italic border-l-4 border-teal-500 pl-4">
            "As a Sukoon Professional, you are the first line of defense for a client's mental health. Your conduct must be impeccable."
        </p>

        <div className="space-y-8">
            <section>
                <h3 className="text-xl font-bold mb-3">A. The "Polite Decline" Rule (Burnout Management)</h3>
                <p className="text-slate-600 mb-4">We understand that therapists are human. If you are exhausted, sick, or mentally drained, do not force a session.</p>
                <ul className="list-disc pl-5 space-y-2 text-slate-600">
                    <li><strong>Protocol:</strong> It is better to reschedule 2 hours in advance using the "Polite Decline" tool than to attend a session with low energy or irritation.</li>
                    <li><strong>The Rule:</strong> If you attend a session, you must be 100% present. Checking phones, multitasking, or sounding dismissive is grounds for immediate review.</li>
                </ul>
            </section>

            <section>
                <h3 className="text-xl font-bold mb-3">B. Zero Judgment Zone</h3>
                <p className="text-slate-600 mb-4">Our clients come from diverse backgrounds (different religions, genders, and academic standings).</p>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700">
                    <strong>Requirement:</strong> You agree to provide unbiased care regardless of the client's personal choices or lifestyle. Promoting personal religious or political agendas during therapy is strictly prohibited.
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold mb-3">C. Punctuality</h3>
                <p className="text-slate-600">
                    <strong>The 5-Minute Rule:</strong> You must be in the video waiting room 2 minutes before the session starts. If you are more than 5 minutes late without notice, the session is free for the client, and the cost is deducted from your wallet.
                </p>
            </section>
        </div>
    </div>
);

export const ClinicalGuidelinesPage: React.FC = () => (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl border border-slate-100 shadow-sm font-sans text-slate-800">
        <h1 className="text-3xl font-bold mb-2">Clinical Guidelines</h1>
        <p className="text-sm font-bold text-indigo-600 mb-8 uppercase tracking-wider">Treating the Gen-Z Client</p>
        
        <p className="mb-8 text-slate-600">
            Our primary demographic is university clients (Ages 18-25). Here is how to connect with them effectively.
        </p>

        <div className="space-y-8">
            <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-teal-700 mb-2">CBT</h4>
                    <p className="text-xs text-slate-600">Best for exam anxiety and academic pressure.</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-indigo-700 mb-2">Mindfulness</h4>
                    <p className="text-xs text-slate-600">Recommended for sleep issues and panic attacks.</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-amber-700 mb-2">SFBT</h4>
                    <p className="text-xs text-slate-600">Best for clients needing quick, actionable advice.</p>
                </div>
            </div>

            <section>
                <h3 className="text-xl font-bold mb-3">2. The "Homework" Standard</h3>
                <p className="text-slate-600 mb-2">Clients love structure. Do not just "talk."</p>
                <p className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-indigo-900 text-sm">
                    <strong>Guideline:</strong> End every session with a small, actionable task (e.g., "Write down 3 worries before bed," or "Try the 4-7-8 breathing technique twice"). This increases retention and client satisfaction.
                </p>
            </section>

            <section>
                <h3 className="text-xl font-bold mb-3">3. Handling "Exam Season"</h3>
                <p className="text-slate-600 mb-2">During Midterms and Finals, expect high anxiety levels.</p>
                <p className="text-slate-600">
                    <strong>Approach:</strong> Focus on grounding techniques rather than deep trauma work during exam weeks. Keep them functional so they can pass their exams first.
                </p>
            </section>
        </div>
    </div>
);

export const CrisisProtocolPage: React.FC = () => (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl border-l-8 border-rose-500 shadow-sm font-sans text-slate-800">
        <h1 className="text-3xl font-bold mb-2 text-rose-700">⚠️ CRITICAL SAFETY STEPS</h1>
        <p className="text-slate-600 mb-8">
            If a client indicates intent for Suicide, Self-Harm, or Harm to Others, follow this checklist immediately.
        </p>

        <div className="space-y-6">
            <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold shrink-0">1</div>
                <div>
                    <h3 className="font-bold text-lg">Do Not Disconnect</h3>
                    <p className="text-slate-600 text-sm mt-1">Keep the client on the video call. Maintain a calm, low, and slow voice.</p>
                    <p className="text-slate-600 text-sm mt-2 italic">Say: "I care about your safety. I want to make sure you are safe right now. Can you stay on the line with me?"</p>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold shrink-0">2</div>
                <div>
                    <h3 className="font-bold text-lg">The Assessment (SLAP)</h3>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div className="bg-rose-50 p-2 rounded border border-rose-100"><strong>Specificity:</strong> Do they have a plan?</div>
                        <div className="bg-rose-50 p-2 rounded border border-rose-100"><strong>Lethality:</strong> Is the method deadly?</div>
                        <div className="bg-rose-50 p-2 rounded border border-rose-100"><strong>Availability:</strong> Access to method?</div>
                        <div className="bg-rose-50 p-2 rounded border border-rose-100"><strong>Proximity:</strong> When do they plan to do it?</div>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold shrink-0">3</div>
                <div>
                    <h3 className="font-bold text-lg">Trigger the "Risk Radar"</h3>
                    <p className="text-slate-600 text-sm mt-1">Click the 🚨 Emergency Alert button on your chat dashboard. This instantly notifies the Admin and the Campus Safety Team (if applicable).</p>
                    <p className="text-rose-700 font-bold text-xs mt-2 bg-rose-100 p-2 rounded">
                        Do not promise confidentiality regarding safety. Tell them: "I am worried about you, and I need to involve someone who can help keep you safe."
                    </p>
                </div>
            </div>
        </div>
    </div>
);

export const PayoutPolicyPage: React.FC = () => (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl border border-slate-100 shadow-sm font-sans text-slate-800">
        <h1 className="text-3xl font-bold mb-2">Payout & Commission Policy</h1>
        <p className="text-sm font-bold text-teal-600 mb-8 uppercase tracking-wider">How You Get Paid</p>
        
        <p className="mb-8 text-slate-600">Transparency is our currency. Here is exactly how the money works.</p>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div className="text-2xl mb-2">📉</div>
                <h3 className="font-bold text-lg mb-2">1. The 20% Platform Fee</h3>
                <p className="text-sm text-slate-600 mb-2">Sukoon deducts a flat 20% service fee from every session.</p>
                <p className="text-xs text-slate-500"><strong>Covers:</strong> Server costs, video hosting, marketing, and payment gateway charges.</p>
                <p className="text-sm font-bold text-teal-600 mt-3">Your Share: 80%</p>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div className="text-2xl mb-2">🗓️</div>
                <h3 className="font-bold text-lg mb-2">2. The 29-Day Rolling Clearance</h3>
                <p className="text-sm text-slate-600 mb-2">Money earned today becomes available for withdrawal in exactly 29 days.</p>
                <p className="text-xs text-slate-500"><strong>Reason:</strong> "Security Hold" protects against fraud, chargebacks, and disputes.</p>
                <p className="text-xs text-slate-500 mt-2 italic">Example: Jan 1st session clears Jan 30th.</p>
            </div>
        </div>

        <section className="bg-teal-50 p-6 rounded-2xl border border-teal-100">
            <h3 className="font-bold text-lg text-teal-800 mb-2">3. Withdrawal Methods</h3>
            <p className="text-sm text-teal-700 mb-2">We support IBAN transfers to all major Pakistani banks (HBL, Meezan, etc.) and Mobile Wallets (EasyPaisa, JazzCash).</p>
            <p className="text-xs font-bold text-teal-900 bg-white/50 p-2 rounded inline-block">
                Important: The account title MUST match your Therapist ID name. We do not transfer to third-party accounts.
            </p>
        </section>
    </div>
);

export const NonCircumventionPage: React.FC = () => (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl border border-slate-100 shadow-sm font-sans text-slate-800">
        <h1 className="text-3xl font-bold mb-2">Terms (Non-Circumvention)</h1>
        <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-wider">The "Iron Dome" Privacy Contract</p>
        
        <div className="bg-slate-900 text-white p-6 rounded-2xl mb-8">
            <h3 className="text-xl font-bold text-rose-400 mb-2">The "One Strike" Policy</h3>
            <p className="text-sm text-slate-300 mb-4">
                Sukoon employs automated AI text scanning. If you attempt to move a client off-platform, the following actions occur automatically:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                <li><strong>Immediate Suspension:</strong> Your profile is hidden.</li>
                <li><strong>Wallet Freeze:</strong> All pending earnings are locked.</li>
                <li><strong>Permanent Ban:</strong> You are blacklisted from Sukoon.</li>
            </ul>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
            <section>
                <h3 className="font-bold text-lg mb-3">🚫 Prohibited Actions</h3>
                <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex gap-2"><span className="text-rose-500">×</span> Asking for a client’s WhatsApp number.</li>
                    <li className="flex gap-2"><span className="text-rose-500">×</span> Sharing your personal email or Instagram handle.</li>
                    <li className="flex gap-2"><span className="text-rose-500">×</span> Offering a "discount" for direct payment.</li>
                    <li className="flex gap-2"><span className="text-rose-500">×</span> Sending external Zoom links via email.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-lg mb-3">❓ Why?</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                    When you go off-platform, there is no record of the session. If a client harasses you or refuses to pay, we cannot help you. If a client is harmed, you are personally liable.
                </p>
            </section>
        </div>
    </div>
);

// --- Dynamic Form Page ---

export const ReportIncidentPage: React.FC = () => {
    const [incidentType, setIncidentType] = useState('Harassment / Abusive Language');
    const [clientName, setClientName] = useState('');
    const [time, setTime] = useState('');
    const [desc, setDesc] = useState('');
    
    // Mock Data loading
    const [patients, setPatients] = useState<TherapistConnection[]>([]);
    const [therapistId] = useState('th-test-01'); // In real app, get from context

    useEffect(() => {
        getTherapistPatients(therapistId).then(setPatients);
    }, []);

    const handleSubmit = async () => {
        if (!clientName || !desc) { alert("Please fill in all fields."); return; }
        
        const incident: SafetyIncident = {
            id: crypto.randomUUID(),
            therapistId,
            type: incidentType as any,
            clientName,
            timeOfIncident: time || new Date().toISOString(),
            description: desc,
            status: 'Reported',
            timestamp: Date.now()
        };

        await reportSafetyIncident(incident);
        alert("Incident Reported. The Trust & Safety team has been notified.");
        setDesc('');
        setClientName('');
    };

    return (
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-3xl border border-slate-100 shadow-sm font-sans text-slate-800">
            <h1 className="text-3xl font-bold mb-2 text-rose-600">Report Safety Incident</h1>
            <p className="text-slate-500 mb-8">
                Use this form for Behavioral Issues, Harassment, or Safety Threats. (For technical bugs, use the 'Support Ticket' instead).
            </p>

            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Incident Type</label>
                    <select 
                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                        value={incidentType}
                        onChange={e => setIncidentType(e.target.value)}
                    >
                        <option>Self-Harm / Suicide Risk (High Priority)</option>
                        <option>Harassment / Abusive Language</option>
                        <option>Privacy Violation</option>
                        <option>Inappropriate Behavior</option>
                    </select>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Client Involved</label>
                        <select 
                            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                            value={clientName}
                            onChange={e => setClientName(e.target.value)}
                        >
                            <option value="">Select Client...</option>
                            {patients.map(p => <option key={p.id} value={p.clientName}>{p.clientName}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Time of Incident</label>
                        <input 
                            type="datetime-local"
                            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                    <textarea 
                        className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none h-32 resize-none placeholder-slate-400"
                        placeholder='Quote exactly what was said. Be objective.'
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                    />
                </div>

                <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center text-sm text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors">
                    📂 Upload Chat Screenshot / Audio Evidence
                </div>

                <button 
                    onClick={handleSubmit}
                    className="w-full py-4 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 shadow-lg transition-transform hover:scale-105"
                >
                    Submit Risk Report
                </button>

                <p className="text-xs text-center text-slate-400 mt-4">
                    High Priority reports trigger an immediate SMS alert to Admins.
                </p>
            </div>
        </div>
    );
};
