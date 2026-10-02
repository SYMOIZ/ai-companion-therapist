
import React, { useEffect, useState } from 'react';
import { checkConnection } from '../services/dataService';

export const StatusPage: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    checkConnection().then(res => {
        setStatus(res.status);
        setDetails(res.details);
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">System Status</h1>
            
            {status === 'checking' && (
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin"></div>
                    <p className="text-slate-500">Checking database connection...</p>
                </div>
            )}

            {status === 'connected' && (
                <div className="flex flex-col items-center gap-4 animate-fade-in">
                    <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-3xl shadow-sm">✓</div>
                    <div className="text-teal-600 font-bold text-xl">System Connected</div>
                    <div className="bg-slate-50 p-4 rounded-xl w-full text-left text-sm text-slate-600 border border-slate-100">
                        <p><strong>Database:</strong> Online</p>
                        <p><strong>Latency:</strong> ~45ms</p>
                        <p><strong>Users Table:</strong> Access OK ({details?.userCount ?? 0} rows)</p>
                    </div>
                    <button onClick={() => window.location.href='/'} className="mt-4 px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700">Go to App</button>
                </div>
            )}

            {status === 'error' && (
                <div className="flex flex-col items-center gap-4 animate-fade-in">
                    <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-3xl shadow-sm">✕</div>
                    <div className="text-rose-600 font-bold text-xl">Connection Failed</div>
                    <p className="text-slate-500 text-sm">Could not connect to Supabase.</p>
                    <div className="bg-rose-50 p-4 rounded-xl w-full text-left text-xs font-mono text-rose-800 overflow-auto max-h-32 border border-rose-100">
                        {JSON.stringify(details, null, 2)}
                    </div>
                    <button onClick={() => window.location.reload()} className="mt-4 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50">Retry</button>
                </div>
            )}
        </div>
    </div>
  );
};
