
import React, { useState } from 'react';
import { Therapist } from '../types';
import { supabase } from '../services/supabaseClient';

interface TherapistInspectorProps {
  therapist: Therapist;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason?: string) => void;
  isProcessing?: boolean;
}

export const TherapistInspector: React.FC<TherapistInspectorProps> = ({ therapist, onClose, onApprove, onReject, isProcessing }) => {
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null); // Track which doc is loading
  const [missingDocs, setMissingDocs] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleViewDocument = async (type: 'cv' | 'degree', path?: string) => {
    if (!path || path === 'N/A') {
        return;
    }
    
    try {
      setLoadingDoc(type);
      
      // Check if we already know it's missing
      if (missingDocs.has(type)) return;

      const { data, error } = await supabase
        .storage
        .from('therapist-documents') 
        .createSignedUrl(path, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        throw new Error("Could not generate URL");
      }
    } catch (e: any) {
      console.error("Document Access Error:", e);
      // Mark as missing to update UI
      setMissingDocs(prev => new Set(prev).add(type));
      
      // Optional: User feedback
      if (e.message && (e.message.includes("Object not found") || e.message.includes("resource"))) {
          // Silent fail with UI update (button turns red/disabled)
      } else {
          alert(`Error: ${e.message}`);
      }
    } finally {
      setLoadingDoc(null);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="bg-white dark:bg-navy-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-slate-200 dark:border-navy-700 flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-navy-800 flex justify-between items-center sticky top-0 bg-white dark:bg-navy-900 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              {therapist.name}
              <span className={`text-[10px] px-2 py-1 rounded-full uppercase ${therapist.status === 'LIVE' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                {therapist.status}
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">{therapist.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-full text-slate-500">✕</button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          
          {/* 1. Professional Details */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Professional Profile</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-100 dark:border-navy-800">
                <label className="block text-xs font-bold text-slate-500 mb-1">Specialty</label>
                <div className="font-bold text-slate-800 dark:text-white">{therapist.specialty || 'N/A'}</div>
              </div>
              <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-100 dark:border-navy-800">
                <label className="block text-xs font-bold text-slate-500 mb-1">Experience</label>
                <div className="font-bold text-slate-800 dark:text-white">{therapist.experience} Years</div>
              </div>
              <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-100 dark:border-navy-800">
                <label className="block text-xs font-bold text-slate-500 mb-1">Languages</label>
                <div className="font-bold text-slate-800 dark:text-white">{therapist.languages?.join(', ') || 'English'}</div>
              </div>
              <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-100 dark:border-navy-800">
                <label className="block text-xs font-bold text-slate-500 mb-1">License No.</label>
                <div className="font-bold text-slate-800 dark:text-white">{therapist.licenseNumber || 'N/A'}</div>
              </div>
            </div>
          </section>

          {/* 2. Documents */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Verification Documents</h3>
            <div className="flex gap-4">
               {/* CV Button */}
               {therapist.cvFileName && therapist.cvFileName !== 'N/A' ? (
                   <button 
                     onClick={() => handleViewDocument('cv', therapist.cvFileName)}
                     className={`flex-1 p-4 border-2 border-dashed rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                        missingDocs.has('cv') 
                        ? 'border-rose-200 bg-rose-50 text-rose-400 cursor-not-allowed' 
                        : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                     }`}
                     disabled={loadingDoc === 'cv' || missingDocs.has('cv')}
                   >
                     {missingDocs.has('cv') ? (
                        <><span>⚠️</span> File Not Found</>
                     ) : loadingDoc === 'cv' ? (
                        'Loading...'
                     ) : (
                        <><span>📄</span> View CV / Resume</>
                     )}
                   </button>
               ) : (
                   <div className="flex-1 p-4 border-2 border-dashed border-slate-200 rounded-xl font-bold flex items-center justify-center text-slate-400 text-sm">
                      No CV attached
                   </div>
               )}
               
               {/* Degree Button */}
               {therapist.degreeFileName && therapist.degreeFileName !== 'N/A' ? (
                   <button 
                     onClick={() => handleViewDocument('degree', therapist.degreeFileName)}
                     className={`flex-1 p-4 border-2 border-dashed rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                        missingDocs.has('degree') 
                        ? 'border-rose-200 bg-rose-50 text-rose-400 cursor-not-allowed' 
                        : 'border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700'
                     }`}
                     disabled={loadingDoc === 'degree' || missingDocs.has('degree')}
                   >
                     {missingDocs.has('degree') ? (
                        <><span>⚠️</span> File Not Found</>
                     ) : loadingDoc === 'degree' ? (
                        'Loading...'
                     ) : (
                        <><span>🎓</span> View Degree</>
                     )}
                   </button>
               ) : (
                   <div className="flex-1 p-4 border-2 border-dashed border-slate-200 rounded-xl font-bold flex items-center justify-center text-slate-400 text-sm">
                      No Degree attached
                   </div>
               )}
            </div>
            {(therapist.cvFileName || therapist.degreeFileName) && (
                <div className="mt-2 text-center space-y-1">
                    {therapist.cvFileName && <p className="text-[10px] text-slate-400 font-mono">CV: {therapist.cvFileName}</p>}
                    {therapist.degreeFileName && <p className="text-[10px] text-slate-400 font-mono">Degree: {therapist.degreeFileName}</p>}
                </div>
            )}
          </section>

          {/* 3. Banking */}
          <section className="space-y-4">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Banking & Metadata</h3>
             <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl border border-slate-100 dark:border-navy-800 text-sm font-mono text-slate-600 dark:text-slate-400 overflow-x-auto">
                <p><strong>Bank:</strong> {therapist.bankDetails?.bankName || 'Not set'}</p>
                <p><strong>Title:</strong> {therapist.bankDetails?.accountTitle || 'Not set'}</p>
                <p><strong>IBAN:</strong> {therapist.bankDetails?.iban || 'Not set'}</p>
                <p className="mt-2 text-xs opacity-50">Raw Booking URL: {therapist.bookingUrl}</p>
             </div>
          </section>

        </div>
        
        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 rounded-b-3xl flex justify-between items-center">
            {onApprove && onReject ? (
                <div className="flex gap-4 w-full">
                    {showRejectInput ? (
                        <div className="flex-1 flex gap-2 animate-fade-in">
                            <input 
                                className="flex-1 p-3 rounded-xl border border-rose-200 bg-white text-sm outline-none"
                                placeholder="Reason for rejection..."
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                autoFocus
                            />
                            <button onClick={() => onReject(therapist.id, rejectReason)} className="px-4 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700">Confirm Reject</button>
                            <button onClick={() => setShowRejectInput(false)} className="px-4 text-slate-500 font-bold hover:bg-slate-200 rounded-xl">Cancel</button>
                        </div>
                    ) : (
                        <>
                            <button onClick={() => setShowRejectInput(true)} className="px-6 py-3 border border-slate-300 text-slate-600 font-bold rounded-xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors">
                                ❌ Reject
                            </button>
                            <button disabled={isProcessing} onClick={() => onApprove(therapist.id)} className="flex-1 px-6 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                <span>✅</span> {isProcessing ? 'Processing...' : 'Approve & Onboard'}
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <button onClick={onClose} className="ml-auto px-6 py-3 bg-slate-200 dark:bg-navy-800 text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-300 transition-colors">
                    Close Inspector
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
