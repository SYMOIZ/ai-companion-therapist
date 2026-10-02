import React, { useState, useEffect } from 'react';
import { 
    getRiskAlerts, 
    getAllTherapists, 
    assignTherapistToAlert, 
    resolveRiskAlert, 
    checkAndEscalateUnresponsiveAssignments 
} from '../../services/dataService';
import { RiskAlert } from '../../types';
import { Search, Shield, AlertTriangle, CheckCircle, Clock, RefreshCw, UserCheck, Play, UserPlus, HelpCircle } from 'lucide-react';

export const RiskRadar: React.FC = () => {
    const [alerts, setAlerts] = useState<RiskAlert[]>([]);
    const [therapists, setTherapists] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Handling' | 'Resolved'>('All');
    
    // Modal & Action state
    const [selectedAlert, setSelectedAlert] = useState<RiskAlert | null>(null);
    const [therapistSearch, setTherapistSearch] = useState('');
    const [assigningAlertId, setAssigningAlertId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [alertsData, therapistsData] = await Promise.all([
                getRiskAlerts(),
                getAllTherapists()
            ]);
            setAlerts(alertsData);
            setTherapists(therapistsData);
            
            // Check for elapsed deadlines upon dashboard refresh to ensure real-time consistency
            await checkAndEscalateUnresponsiveAssignments();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignTherapist = async (alertId: string, therapistId: string) => {
        try {
            await assignTherapistToAlert(alertId, therapistId);
            setSuccessMessage("Therapist successfully assigned! Notification dispatched to therapist.");
            setAssigningAlertId(null);
            setSelectedAlert(null);
            await loadData();
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (e) {
            alert("Error assigning therapist.");
        }
    };

    const handleResolveAlert = async (alertId: string) => {
        try {
            await resolveRiskAlert(alertId);
            setSuccessMessage("Case successfully resolved. Banner removed for client.");
            await loadData();
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (e) {
            alert("Error resolving alert.");
        }
    };

    const handleTriggerSlaSimulation = async () => {
        setLoading(true);
        try {
            const count = await checkAndEscalateUnresponsiveAssignments();
            setSuccessMessage(`SLA simulation executed successfully! ${count} unresponsive therapist cases escalated.`);
            await loadData();
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (e) {
            alert("Error running SLA simulation.");
        } finally {
            setLoading(false);
        }
    };

    // Filter logic
    const filteredAlerts = alerts.filter(alert => {
        const matchesSearch = 
            alert.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            alert.triggerKeyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (alert.message && alert.message.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (alert.assignedTherapistId && therapists.find(t => t.id === alert.assignedTherapistId)?.name.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'All' || alert.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getTherapistName = (id?: string) => {
        if (!id) return 'Unassigned';
        return therapists.find(t => t.id === id)?.name || 'Unknown Therapist';
    };

    return (
        <div className="space-y-6 animate-fade-in relative h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-rose-50 dark:bg-rose-950/20 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-rose-800 dark:text-rose-400 flex items-center gap-3">
                        <span className="relative flex h-4 w-4">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
                        </span>
                        Risk Radar & Crisis Interventions
                    </h1>
                    <p className="text-rose-600 dark:text-rose-300 text-sm mt-1">
                        Active SLA and therapist assignment response workflows.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleTriggerSlaSimulation}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-sm transition-all"
                        title="Evaluates pending cases and escalates/reassigns those exceeding SLA response time"
                    >
                        <Play className="w-3.5 h-3.5" /> Simulate SLA Expiry
                    </button>
                    <button 
                        onClick={loadData}
                        className="p-2.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-all"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Success Notification Bar */}
            {successMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-slide-in">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="font-medium">{successMessage}</span>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-navy-900 p-4 rounded-xl border border-slate-200 dark:border-navy-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="relative w-full md:w-96">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                        <Search className="w-4 h-4" />
                    </span>
                    <input 
                        type="text"
                        placeholder="Search by client, keyword, or therapist..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    {(['All', 'Active', 'Handling', 'Resolved'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                statusFilter === status 
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Alert List */}
            <div className="flex-1 bg-white dark:bg-navy-900 rounded-2xl shadow-sm border border-slate-200 dark:border-navy-800 overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-sm">Refreshing Queue...</span>
                    </div>
                ) : filteredAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                        <Shield className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-sm font-medium">Safe. No flagged threats match current parameters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="bg-rose-50/50 text-rose-800 font-semibold text-xs border-b border-rose-100">
                                    <th className="p-4">Flagged Client</th>
                                    <th className="p-4">Trigger Word / Message</th>
                                    <th className="p-4">Detected On</th>
                                    <th className="p-4">Status & SLA Progress</th>
                                    <th className="p-4 text-right">Intervention Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredAlerts.map(alert => {
                                    const assignedTherapist = therapists.find(t => t.id === alert.assignedTherapistId);
                                    const isPendingSLA = alert.assignmentStatus === 'pending';
                                    const hasBreached = alert.responseDeadline && new Date(alert.responseDeadline) < new Date();

                                    return (
                                        <tr key={alert.id} className="hover:bg-slate-50/40 transition-colors">
                                            <td className="p-4">
                                                <div className="font-semibold text-slate-800">{alert.clientName}</div>
                                                <div className="text-xs text-slate-400">ID: {alert.clientId}</div>
                                            </td>
                                            <td className="p-4 max-w-xs md:max-w-md">
                                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                    <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md font-mono text-xs border border-rose-200">
                                                        "{alert.triggerKeyword}"
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 line-clamp-2">{alert.message || 'Immediate system flag generated.'}</p>
                                            </td>
                                            <td className="p-4 text-xs text-slate-500">
                                                {new Date(alert.detectedAt).toLocaleString()}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                            alert.status === 'Active' ? 'bg-amber-100 text-amber-800' :
                                                            alert.status === 'Handling' ? 'bg-indigo-100 text-indigo-800' :
                                                            'bg-emerald-100 text-emerald-800'
                                                        }`}>
                                                            {alert.status}
                                                        </span>
                                                        {alert.followupStatus && (
                                                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-semibold uppercase">
                                                                Follow-up: {alert.followupStatus}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Assignment Status details */}
                                                    {alert.assignedTherapistId && (
                                                        <div className="text-xs space-y-1">
                                                            <div className="text-slate-600">
                                                                Assigned: <span className="font-semibold text-slate-800">{getTherapistName(alert.assignedTherapistId)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`w-2 h-2 rounded-full ${
                                                                    alert.assignmentStatus === 'accepted' ? 'bg-emerald-500' :
                                                                    alert.assignmentStatus === 'rejected' ? 'bg-rose-500' :
                                                                    'bg-amber-500 animate-pulse'
                                                                }`} />
                                                                <span className="text-slate-500 capitalize">
                                                                    Assignment: {alert.assignmentStatus}
                                                                </span>
                                                            </div>
                                                            {isPendingSLA && alert.responseDeadline && (
                                                                <div className={`flex items-center gap-1 text-[11px] font-medium ${hasBreached ? 'text-rose-600' : 'text-slate-500'}`}>
                                                                    <Clock className="w-3 h-3" />
                                                                    SLA Limit: {new Date(alert.responseDeadline).toLocaleTimeString()} {hasBreached && '(Breached)'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {alert.status !== 'Resolved' && (
                                                        <>
                                                            <button 
                                                                onClick={() => {
                                                                    setAssigningAlertId(alert.id);
                                                                    setSelectedAlert(alert);
                                                                }}
                                                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                                                            >
                                                                <UserPlus className="w-3.5 h-3.5" /> 
                                                                {alert.assignedTherapistId ? 'Reassign' : 'Assign Therapist'}
                                                            </button>
                                                            <button 
                                                                onClick={() => handleResolveAlert(alert.id)}
                                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 shadow-sm transition-all"
                                                            >
                                                                Resolve
                                                            </button>
                                                        </>
                                                    )}
                                                    {alert.status === 'Resolved' && (
                                                        <span className="text-emerald-500 text-xs font-semibold flex items-center gap-1">
                                                            <CheckCircle className="w-4 h-4" /> Case Closed
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Therapist Assignment Selection Modal */}
            {assigningAlertId && selectedAlert && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-scale-in">
                    <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                        <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-rose-500" /> Crisis Therapist Dispatch
                                </h2>
                                <p className="text-slate-400 text-xs mt-0.5">Assign certified medical support for patient: {selectedAlert.clientName}</p>
                            </div>
                            <button onClick={() => setAssigningAlertId(null)} className="text-slate-400 hover:text-white text-xl font-bold">×</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                                    <Search className="w-4 h-4" />
                                </span>
                                <input 
                                    type="text"
                                    placeholder="Search therapists by name or specialty..."
                                    value={therapistSearch}
                                    onChange={(e) => setTherapistSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                                />
                            </div>

                            <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                                {therapists
                                    .filter(t => t.name.toLowerCase().includes(therapistSearch.toLowerCase()) || t.specialty.toLowerCase().includes(therapistSearch.toLowerCase()))
                                    .map(therapist => (
                                        <div 
                                            key={therapist.id} 
                                            className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 transition-all cursor-pointer group"
                                            onClick={() => handleAssignTherapist(assigningAlertId, therapist.id)}
                                        >
                                            <div>
                                                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                                    {therapist.name}
                                                    {therapist.isCrisisCertified && (
                                                        <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase">
                                                            Crisis Certified
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-500">{therapist.specialty} • {therapist.experience} Yrs Exp</div>
                                            </div>
                                            <span className="text-xs bg-slate-900 text-white font-medium px-2.5 py-1.5 rounded-lg group-hover:bg-rose-600 transition-colors">
                                                Assign
                                            </span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
