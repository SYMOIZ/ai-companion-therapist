
import React from 'react';

export const CrisisPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-2xl w-full bg-white p-10 rounded-3xl shadow-2xl border-t-8 border-rose-500">
          <h1 className="text-4xl font-bold text-rose-600 mb-6">Crisis Support</h1>
          <p className="text-xl text-slate-700 mb-8 font-medium">
              If you are in urgent danger, please contact your local emergency services immediately.
          </p>
          
          <div className="space-y-4 mb-10 text-left">
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-slate-900 text-lg">Emergency Services</h3>
                  <p className="text-slate-600">Call <strong>911</strong> (US) or <strong>112</strong> (EU/UK)</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-slate-900 text-lg">Suicide & Crisis Lifeline</h3>
                  <p className="text-slate-600">Call or Text <strong>988</strong> (US/Canada)</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <h3 className="font-bold text-slate-900 text-lg">International Directories</h3>
                  <p className="text-slate-600"><a href="https://findahelpline.com/" target="_blank" className="text-teal-600 underline">Find a Helpline</a></p>
              </div>
          </div>

          <p className="text-sm text-slate-400">
              Sukoon AI is an automated system and cannot provide medical care or emergency intervention.
          </p>
      </div>
    </div>
  );
};