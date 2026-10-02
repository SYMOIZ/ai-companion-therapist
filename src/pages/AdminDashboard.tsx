
import React, { useState, useEffect } from 'react';
import { Skeleton } from '../components/Skeleton';
import { getAdminStats, getTherapists, getTherapistApplications, approveTherapistApplication, rejectTherapistApplication, deleteTherapist, getAdminUsers, getAdminAlerts, resolveAlert, getTransactions, getInvestments, addInvestment, deleteInvestment, updateInvestment, addTransaction, deleteTransaction, getChatThreads, getSystemHealth, suspendUser, getMonetizationSettings, updateMonetizationSettings, getTherapistConnections, breakConnection, sendSystemBlast, getSystemNotifications, getBroadcastHistory, assignTherapist, getRecommendedTherapists, sendIntervention, getTeamMembers, addTeamMember, revokeTeamAccess, updateTeamMemberStatus, getPayoutRequests, processPayout, getCompanyExpenses, addCompanyExpense, recordManualPayout, createNotification, updateMeetingLink } from '../services/dataService';
import { AdminStats, Therapist, AdminUserView, AdminAlert, Transaction, Investment, ChatThread, SystemHealth, MonetizationConfig, TherapistConnection, SystemNotification, TherapistApplication, Broadcast, TeamMember, TeamRole, TeamPermissions, PayoutRequest, CompanyExpense } from '../types';
import { TherapistInspector } from '../components/TherapistInspector';
import { SearchableSelect } from '../components/SearchableSelect';
import { AdminSupport } from './admin/Support';
import { AdminMessages } from './admin/Messages';
import { RiskRadar } from '../components/admin/RiskRadar';
import { AddTeamModal } from '../components/admin/modals/AddTeamModal';
import { ManualAssignModal } from '../components/admin/modals/ManualAssignModal';
import { ConnectionDetailsModal } from '../components/admin/modals/ConnectionDetailsModal';
import { FinanceDashboard } from './admin/Finance';
import { SubscriptionsDashboard } from './admin/Subscriptions';

// --- UTILS ---
interface StatCardProps { label: string; value: React.ReactNode; sub: string; color?: string }
const StatCard: React.FC<StatCardProps> = ({ label, value, sub, color = "teal" }) => (
    <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-navy-700">
        <div className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold tracking-wider mb-2">{label}</div>
        <div className={`text-3xl font-sans font-bold text-${color}-600 dark:text-white mb-1`}>{value}</div>
        <div className={`text-xs text-${color}-500 font-medium`}>{sub}</div>
    </div>
);

// --- VIEWS ---

const UsersView = ({ users, onRefresh }: { users: AdminUserView[], onRefresh: () => void }) => {
    // ... existing code ...
    const handleSuspend = async (id: string, name: string) => {
        if(confirm(`Are you sure you want to suspend ${name}?`)) {
            try {
                await suspendUser(id, "Admin Action");
                onRefresh();
            } catch (e) {
                alert("Failed to suspend user. Please try again.");
            }
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">User Management</h1>
                <div className="text-sm text-slate-500">{users.length} Registered Users</div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-700 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4">User Details</th>
                            <th className="p-4">Demographics</th>
                            <th className="p-4">Risk Status</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                        {users.length === 0 ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                                <tr key={idx} className="animate-pulse">
                                    <td className="p-4">
                                        <Skeleton className="h-5 w-32 mb-2" />
                                        <Skeleton className="h-4 w-24" />
                                    </td>
                                    <td className="p-4"><Skeleton className="h-4 w-40" /></td>
                                    <td className="p-4"><Skeleton className="h-5 w-16" /></td>
                                    <td className="p-4"><Skeleton className="h-5 w-14" /></td>
                                    <td className="p-4"><Skeleton className="h-8 w-16" /></td>
                                </tr>
                            ))
                        ) : users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-navy-700">
                                <td className="p-4">
                                    <div className="font-bold text-slate-800 dark:text-white">{u.name}</div>
                                    <div className="text-xs text-slate-400">{u.email}</div>
                                </td>
                                <td className="p-4 text-slate-600 dark:text-slate-300">
                                    {u.age} y/o • {u.gender} • {u.region}
                                </td>
                                <td className="p-4">
                                    {u.riskLevel === 'critical' ? (
                                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 animate-pulse">Critical</span>
                                    ) : u.riskLevel === 'moderate' ? (
                                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-700">Moderate</span>
                                    ) : (
                                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-500">Low</span>
                                    )}
                                </td>
                                <td className="p-4">
                                     <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.status === 'active' ? 'bg-teal-100 text-teal-700' : 'bg-rose-100 text-rose-700'}`}>
                                        {u.status}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {u.status === 'active' && (
                                        <button onClick={() => handleSuspend(u.id, u.name)} className="text-rose-500 hover:text-rose-700 font-bold text-xs border border-rose-200 px-3 py-1 rounded hover:bg-rose-50">Suspend</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const TherapistsView = ({ therapists, applications, setApplications, onRefresh }: { therapists: Therapist[], applications: TherapistApplication[], setApplications: React.Dispatch<React.SetStateAction<TherapistApplication[]>>, onRefresh: () => void }) => {
    const pendingApps = applications.filter(a => (a.status || '').toLowerCase() === 'pending');
    const [tab, setTab] = useState<'active' | 'pending'>('active');
    const [isProcessing, setIsProcessing] = useState(false);
    const [inspectingTherapist, setInspectingTherapist] = useState<Therapist | null>(null);

    const handleApprove = async (id: string) => {
        console.log("handleApprove executing for id:", id);
        setIsProcessing(true);
        const app = (applications.find(a => a.id === id || a.userId === id) || therapists.find(t => t.id === id)) as any;
        if (app) {
            try {
                await approveTherapistApplication(app.id);
                console.log("approveTherapistApplication successful");
                setApplications((prev: TherapistApplication[]) => prev.map(a => a.id === app.id || a.userId === app.userId ? {...a, status: 'approved'} : a));
                setInspectingTherapist(null);
                onRefresh();
            } catch (e) {
                console.error("Failed to approve", e);
                alert("Failed to approve. Check console.");
            } finally {
                setIsProcessing(false);
            }
        } else {
            console.warn("Could not find app/therapist for id:", id);
            setIsProcessing(false);
        }
    };

    const handleReject = async (id: string, reason?: string) => {
        const app = applications.find(a => a.id === id || a.userId === id) || therapists.find(t => t.id === id);
        if (app) {
            await rejectTherapistApplication(app.id, reason);
            setInspectingTherapist(null);
            onRefresh();
        }
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
             {inspectingTherapist && (
                 <TherapistInspector 
                    therapist={inspectingTherapist} 
                    onClose={() => setInspectingTherapist(null)} 
                    onApprove={inspectingTherapist.status !== 'LIVE' ? handleApprove : undefined}
                    onReject={inspectingTherapist.status !== 'LIVE' ? handleReject : undefined}
                    isProcessing={isProcessing}
                 />
             )}

             <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Therapist Network</h1>
                <div className="flex bg-white dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-700 p-1">
                    <button onClick={() => setTab('active')} className={`px-4 py-2 text-sm font-bold rounded-md ${tab === 'active' ? 'bg-slate-100 dark:bg-navy-700 text-slate-800 dark:text-white' : 'text-slate-500'}`}>Active ({therapists.length})</button>
                    <button onClick={() => setTab('pending')} className={`px-4 py-2 text-sm font-bold rounded-md ${tab === 'pending' ? 'bg-slate-100 dark:bg-navy-700 text-slate-800 dark:text-white' : 'text-slate-500'}`}>Pending ({pendingApps.length})</button>
                </div>
            </div>

            {tab === 'active' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {therapists.length === 0 ? (
                        Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="bg-white dark:bg-navy-800 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm animate-pulse space-y-4">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-12 h-12 rounded-full" />
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-5 w-2/3" />
                                        <Skeleton className="h-4 w-1/3" />
                                    </div>
                                </div>
                                <Skeleton className="h-4 w-3/4" />
                                <div className="flex justify-between items-center whitespace-nowrap">
                                    <Skeleton className="h-6 w-14" />
                                    <Skeleton className="h-6 w-24" />
                                </div>
                            </div>
                        ))
                    ) : therapists.map(t => (
                        <div 
                            key={t.id} 
                            onClick={() => setInspectingTherapist(t)}
                            className="bg-white dark:bg-navy-800 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500 relative z-10">{t.name[0]}</div>
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-white">{t.name}</div>
                                    <div className="text-xs text-teal-600">{t.specialty}</div>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 mb-4">{t.experience} Years Exp • {t.languages.join(', ')}</div>
                            <div className="flex justify-between items-center">
                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${t.status === 'LIVE' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {t.status}
                                </span>
                                {t.isCrisisCertified && <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-rose-100 text-rose-700 border border-rose-200">Crisis Certified</span>}
                            </div>
                            
                            {/* "Incomplete" Indicator */}
                            {t.status !== 'LIVE' && (
                                <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-[9px] font-bold px-3 py-1 rounded-bl-xl shadow-sm">
                                    SETUP INCOMPLETE
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {pendingApps.length === 0 ? (
                        Array.from({ length: 2 }).map((_, idx) => (
                            <div key={idx} className="bg-white dark:bg-navy-800 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm animate-pulse flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="space-y-2 flex-1 w-full">
                                    <Skeleton className="h-6 w-1/3 mb-2" />
                                    <Skeleton className="h-4 w-1/2 mb-2" />
                                    <Skeleton className="h-3 w-1/4" />
                                </div>
                                <Skeleton className="h-10 w-32" />
                            </div>
                        ))
                    ) : pendingApps.map(app => (
                        <div key={app.id} className="bg-white dark:bg-navy-800 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white">{app.fullName}</h3>
                                <div className="text-sm text-slate-500">{app.email} • {app.phone}</div>
                                <div className="mt-2 text-xs text-slate-400">EXP: {app.yearsExperience} Years • CV: {app.cvFileName}</div>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setInspectingTherapist({
                                        ...app as any, 
                                        name: app.fullName, 
                                        languages: ['English'], 
                                        specialty: app.specialization,
                                        experience: app.yearsExperience,
                                        status: 'PENDING'
                                    })} 
                                    className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md flex items-center gap-2"
                                >
                                    <span>🔍</span> Review Application
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ConnectionsView = () => {
    const [connections, setConnections] = useState<TherapistConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedConnection, setSelectedConnection] = useState<TherapistConnection | null>(null);

    useEffect(() => {
        refresh();
    }, []);

    const refresh = async () => {
        setLoading(true);
        const data = await getTherapistConnections();
        setConnections(data);
        setLoading(false);
    };

    const handleAssignSubmit = async (data: any) => {
        const success = await assignTherapist(data);
        if (success) {
            // Notify client
            await createNotification(
                data.clientId,
                "Therapist Assigned",
                "An administrator has manually assigned a therapist to you. You can now see them in your chat dashboard.",
                'system'
            );
            // Notify therapist
            await createNotification(
                data.therapistId,
                "New Patient Assigned",
                "A new patient has been assigned to you. Please check your dashboard to manage the connection.",
                'system'
            );
            alert("Assignment Successful. Both parties have been notified.");
            refresh();
            setShowAssignModal(false);
        }
    };

    const handleBreakConnection = async (id: string, clientName: string) => {
        if(confirm(`⚠️ WARNING: Severing this connection will unassign the therapist from ${clientName}. This cannot be undone. Proceed?`)) {
            await breakConnection(id);
            refresh();
        }
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col relative">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Active Connections</h1>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowAssignModal(true)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <span>+</span> Assign Manually
                    </button>
                    <div className="bg-slate-100 dark:bg-navy-700 px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center">
                        Total: {connections.length} Pairs
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-700 overflow-hidden flex-1">
                {loading ? (
                    <div className="space-y-2 p-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="p-4">Client</th>
                                <th className="p-4">Therapist</th>
                                <th className="p-4">Meeting Link</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Stats</th>
                                <th className="p-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-navy-700">
                            {connections.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800 dark:text-white">{c.clientName}</div>
                                        <div className="text-xs text-slate-400">ID: {c.clientId}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800 dark:text-white">{c.therapistName}</div>
                                        <div className="text-xs text-slate-400">ID: {c.therapistId}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="text-xs text-slate-500 max-w-[150px] truncate">
                                            {c.meetingLink ? (
                                                <a href={c.meetingLink} target="_blank" className="text-indigo-600 hover:underline">{c.meetingLink}</a>
                                            ) : (
                                                <span className="italic text-slate-400">No link set</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${c.status === 'ACTIVE' ? 'bg-teal-100 text-teal-800' : c.status === 'DISPUTED' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-xs text-slate-500">
                                        <div>{c.totalSessions} Sessions</div>
                                        <div>Last: {c.lastMeeting}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setSelectedConnection(c)}
                                                className="text-indigo-600 hover:text-indigo-700 font-bold text-xs border border-indigo-200 px-3 py-1.5 rounded hover:bg-indigo-50 transition-colors"
                                            >
                                                Details & Chat
                                            </button>
                                            <button 
                                                onClick={() => handleBreakConnection(c.id, c.clientName)}
                                                className="text-rose-500 hover:text-rose-700 font-bold text-xs border border-rose-200 px-3 py-1.5 rounded hover:bg-rose-50 transition-colors"
                                            >
                                                Sever
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {connections.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-400">No active client-therapist links found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {showAssignModal && (
                <ManualAssignModal 
                    onClose={() => setShowAssignModal(false)}
                    onSubmit={handleAssignSubmit}
                />
            )}

            {selectedConnection && (
                <ConnectionDetailsModal 
                    connection={selectedConnection}
                    onClose={() => setSelectedConnection(null)}
                    onRefresh={refresh}
                />
            )}
        </div>
    );
};

const TeamAccessView = () => {
    // ... existing code ...
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        refresh();
    }, []);

    const refresh = async () => {
        const data = await getTeamMembers();
        setMembers(data);
    };

    const handleAddSubmit = async (data: any) => {
        // Map form data to TeamMember structure
        const permissions: TeamPermissions = { users: 'read', therapists: 'read', finance: 'none', chat: 'none', system: 'locked' };
        if (data.role === 'Super Admin') {
            permissions.users = 'full'; permissions.therapists = 'full'; permissions.finance = 'full'; permissions.chat = 'full';
        } else if (data.role === 'Accountant') {
            permissions.finance = 'full'; permissions.users = 'none';
        }

        await addTeamMember({
            id: '', // Generated in service
            name: data.name,
            email: data.email,
            role: data.role,
            status: data.isActive ? 'Active' : 'Suspended',
            is_active: data.isActive,
            access_expires_at: data.access_expires_at,
            lastLogin: Date.now(),
            addedAt: Date.now(),
            permissions,
            password: data.password // passed to mock auth creator
        });
        refresh();
    };

    const handleRevoke = async (id: string) => {
        if (confirm("Permanently revoke access for this team member?")) {
            await revokeTeamAccess(id);
            refresh();
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
        await updateTeamMemberStatus(id, newStatus);
        refresh();
    };

    const getRoleBadge = (role: TeamRole) => {
        switch(role) {
            case 'Super Admin': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Accountant': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Moderator': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    const formatExpiry = (isoString?: string | null) => {
        if (!isoString) return null;
        const date = new Date(isoString);
        const diff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diff > 0 ? `${diff} days left` : 'Expired';
    };

    return (
        <div className="space-y-8 animate-fade-in relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Team Access</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage staff roles, time-limited access, and permissions.</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                    <span>+</span> Invite Member
                </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {members.map(m => {
                    const daysLeft = formatExpiry(m.access_expires_at);
                    const isExpired = daysLeft === 'Expired' || m.status === 'Expired';
                    
                    return (
                        <div key={m.id} className={`bg-white dark:bg-navy-800 p-6 rounded-2xl border shadow-sm flex flex-col justify-between h-56 transition-all ${isExpired ? 'border-rose-200 dark:border-rose-900/30 opacity-75' : 'border-slate-200 dark:border-navy-700'}`}>
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getRoleBadge(m.role)}`}>
                                        {m.role}
                                    </span>
                                    <button onClick={() => handleRevoke(m.id)} className="text-slate-300 hover:text-rose-500 text-lg" title="Delete User">×</button>
                                </div>
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                                    {m.name}
                                    {m.access_expires_at && !isExpired && <span className="text-amber-500 text-xs" title={`Access expires in ${daysLeft}`}>🕒</span>}
                                </h3>
                                <p className="text-xs text-slate-500">{m.email}</p>
                                
                                {m.access_expires_at && (
                                    <div className={`mt-2 text-[10px] font-mono font-bold px-2 py-1 rounded w-fit ${isExpired ? 'bg-rose-100 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {isExpired ? 'ACCESS EXPIRED' : `Expires: ${new Date(m.access_expires_at).toLocaleDateString()}`}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-4 text-[10px] text-slate-400 font-mono">
                                    <span>Last Login: {new Date(m.lastLogin).toLocaleDateString()}</span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    <div className="flex items-center gap-1">
                                        <div className={`w-2 h-2 rounded-full ${m.status === 'Active' ? 'bg-teal-500' : isExpired ? 'bg-rose-500' : 'bg-slate-400'}`}></div>
                                        <span className={m.status === 'Active' ? 'text-teal-500' : isExpired ? 'text-rose-500' : 'text-slate-500'}>{m.status}</span>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleToggleStatus(m.id, m.status)}
                                        disabled={isExpired}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${m.status === 'Active' ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-teal-200 text-teal-600 hover:bg-teal-50'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {m.status === 'Active' ? 'Suspend' : 'Activate'}
                                    </button>
                                    <button className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50">Edit</button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Invite Modal */}
            {showModal && (
                <AddTeamModal 
                    onClose={() => setShowModal(false)}
                    onSubmit={handleAddSubmit}
                />
            )}
        </div>
    );
};

const MonetizationView = () => <div className="text-center p-10 text-slate-400">Monetization Module (Unchanged)</div>;
const NotificationsView = () => <div className="text-center p-10 text-slate-400">Notifications Module (Unchanged)</div>;

const DashboardHome = ({ stats, health, alerts, onRefreshAlerts, onNavigateRisk }: { stats: AdminStats | null, health: SystemHealth | null, alerts: AdminAlert[], onRefreshAlerts: () => void, onNavigateRisk: () => void }) => {
    // ... existing code ...
    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard label="Total Users" value={stats?.totalUsers || 0} sub="+12% this week" />
                <StatCard label="Active Today" value={stats?.activeUsersToday || 0} sub="Real-time count" color="indigo" />
                <StatCard label="Sessions Held" value={stats?.totalSessions || 0} sub="Avg Duration: 45m" color="amber" />
                <StatCard label="System Health" value={health?.status || 'Unknown'} sub={`Errors: ${health?.apiErrors || 0}`} color={health?.status === 'Healthy' ? 'teal' : 'rose'} />
            </div>

            {/* Gamification Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6 rounded-2xl shadow-sm border border-indigo-400">
                    <div className="text-white/80 text-xs uppercase font-bold tracking-wider mb-2">Total Reward Points Issued</div>
                    <div className="text-4xl font-sans font-bold mb-1">{(stats as any)?.gamification?.total_reward_points || 0}</div>
                    <div className="text-xs text-white/90 font-medium cursor-pointer">Across all system users</div>
                 </div>
                 <div className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white p-6 rounded-2xl shadow-sm border border-teal-400">
                    <div className="text-white/80 text-xs uppercase font-bold tracking-wider mb-2">Total Badges Earned</div>
                    <div className="text-4xl font-sans font-bold mb-1">{(stats as any)?.gamification?.total_badges_earned || 0}</div>
                    <div className="text-xs text-white/90 font-medium cursor-pointer">Badges awarded to users</div>
                 </div>
            </div>

            {/* Risk Banner */}
            <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900 p-6 rounded-2xl flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-rose-800 dark:text-rose-400 flex items-center gap-2">
                        <span className="animate-pulse">🚨</span> Risk Radar Active
                    </h2>
                    <p className="text-sm text-rose-600 dark:text-rose-300 mt-1">Monitor high-risk clients and initiate protocols.</p>
                </div>
                <button onClick={onNavigateRisk} className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg hover:bg-rose-700 hover:scale-105 transition-all">
                    Open Radar
                </button>
            </div>

            {/* Alerts Section */}
            <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-navy-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-700">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Recent Flags</h2>
                    <div className="space-y-4">
                        {alerts.slice(0, 3).map(alert => (
                            <div key={alert.id} className="p-4 bg-slate-50 dark:bg-navy-900 border-l-4 border-amber-500 rounded-r-xl">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-amber-700 uppercase">{alert.type}</span>
                                    <span className="text-xs text-slate-400">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">User: {alert.userName}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">"{alert.message}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface AdminDashboardProps {
  currentView: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentView }) => {
  // Local state to handle internal navigation if needed, though mostly props driven
  const [internalView, setInternalView] = useState(currentView);
  
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [applications, setApplications] = useState<TherapistApplication[]>([]);
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isShellLoading, setIsShellLoading] = useState(false);

  // Track which views have actually been visited to avoid mounting and firing useEffect queries concurrently
  const [visitedViews, setVisitedViews] = useState<Record<string, boolean>>({
      [currentView]: true,
      'admin-dashboard': true,
      'admin-analytics': true
  });

  const loadViewData = async (view: string, force: boolean = false) => {
        // Only trigger visible shell loading if we don't have the cached/existing lists for the target view
        const hasData = (view === 'admin-users' && users.length > 0) ||
                        (view === 'admin-therapists' && therapists.length > 0 && applications.length > 0) ||
                        ((view === 'admin-analytics' || view === 'admin-dashboard' || !view || view === '') && stats !== null);
        
        if (!hasData && !force) {
            setIsShellLoading(true);
        }

        try {
            if (view === 'admin-users') {
                if (users.length === 0 || force) {
                    const u = await getAdminUsers();
                    setUsers(u);
                }
            } else if (view === 'admin-therapists') {
                if (therapists.length === 0 || applications.length === 0 || force) {
                    const [t, app] = await Promise.all([getTherapists(), getTherapistApplications()]);
                    setTherapists(t);
                    setApplications(app);
                }
            } else if (view === 'admin-analytics' || view === 'admin-dashboard' || !view || view === '') {
                if (!stats || !systemHealth || alerts.length === 0 || force) {
                    const [s, h, a] = await Promise.all([
                        getAdminStats(),
                        getSystemHealth(),
                        getAdminAlerts()
                    ]);
                    setStats(s);
                    setSystemHealth(h);
                    setAlerts(a);
                }
            }
        } catch (e) {
            console.error("Dashboard View Load Error", e);
        } finally {
            setIsShellLoading(false);
        }
  };

  const refreshData = async () => {
      await loadViewData(internalView, true);
  };

  useEffect(() => {
    setInternalView(currentView);
    setVisitedViews(prev => ({ ...prev, [currentView]: true }));
    loadViewData(currentView, false);
  }, [currentView]);

  useEffect(() => {
    if (internalView) {
      setVisitedViews(prev => ({ ...prev, [internalView]: true }));
    }
  }, [internalView]);

  const renderContent = () => {
      // Special Override for Risk Radar if triggered internally
      if (internalView === 'risk-radar') return <RiskRadar />;

      if (isShellLoading && stats === null && users.length === 0 && therapists.length === 0) return (
        <div className="space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
      );

      return (
          <div className="relative w-full h-full">
              {/* Dashboard Home tab */}
              <div style={{ display: (internalView === 'admin-dashboard' || internalView === 'admin-analytics' || !internalView || internalView === '') ? 'block' : 'none' }}>
                  <DashboardHome stats={stats} health={systemHealth} alerts={alerts} onRefreshAlerts={refreshData} onNavigateRisk={() => setInternalView('risk-radar')} />
              </div>

              {/* Users tab */}
              {visitedViews['admin-users'] && (
                  <div style={{ display: internalView === 'admin-users' ? 'block' : 'none' }}>
                      <UsersView users={users} onRefresh={refreshData} />
                  </div>
              )}

              {/* Therapists tab */}
              {visitedViews['admin-therapists'] && (
                  <div style={{ display: internalView === 'admin-therapists' ? 'block' : 'none' }}>
                      <TherapistsView therapists={therapists} applications={applications} setApplications={setApplications} onRefresh={refreshData} />
                  </div>
              )}

              {/* Finance tab */}
              {visitedViews['admin-finance'] && (
                  <div style={{ display: internalView === 'admin-finance' ? 'block' : 'none' }}>
                      <FinanceDashboard />
                  </div>
              )}

              {/* Subscriptions tab */}
              {visitedViews['admin-subscriptions'] && (
                  <div style={{ display: internalView === 'admin-subscriptions' ? 'block' : 'none' }}>
                      <SubscriptionsDashboard />
                  </div>
              )}

              {/* Chat messages tab */}
              {visitedViews['admin-chat'] || visitedViews['admin-messages'] ? (
                  <div className="h-full" style={{ display: (internalView === 'admin-chat' || internalView === 'admin-messages') ? 'block' : 'none' }}>
                      <AdminMessages />
                  </div>
              ) : null}

              {/* Support ticket tab */}
              {visitedViews['admin-support'] && (
                  <div style={{ display: internalView === 'admin-support' ? 'block' : 'none' }}>
                      <AdminSupport />
                  </div>
              )}

              {/* Active Connections tab */}
              {visitedViews['admin-connections'] && (
                  <div className="h-full" style={{ display: internalView === 'admin-connections' ? 'block' : 'none' }}>
                      <ConnectionsView />
                  </div>
              )}

              {/* Monetization settings tab */}
              {visitedViews['admin-monetization'] && (
                  <div style={{ display: internalView === 'admin-monetization' ? 'block' : 'none' }}>
                      <MonetizationView />
                  </div>
              )}

              {/* Notifications settings tab */}
              {visitedViews['admin-notifications'] && (
                  <div style={{ display: internalView === 'admin-notifications' ? 'block' : 'none' }}>
                      <NotificationsView />
                  </div>
              )}

              {/* Team access settings tab */}
              {visitedViews['admin-team'] && (
                  <div style={{ display: internalView === 'admin-team' ? 'block' : 'none' }}>
                      <TeamAccessView />
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-900">
        <div className="bg-emerald-600 text-white px-6 py-2 text-xs font-bold uppercase tracking-wider flex justify-between items-center shadow-md z-10">
            <span>Admin Mode — Business Analytics Only</span>
            <div className="flex gap-4">
                 <span className={systemHealth?.status === 'Healthy' ? 'text-white' : 'text-amber-200 animate-pulse'}>
                     System: {systemHealth?.status || 'Unknown'}
                 </span>
                 <span>{new Date().toLocaleDateString()}</span>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-12">
            {renderContent()}
        </div>
    </div>
  );
};
