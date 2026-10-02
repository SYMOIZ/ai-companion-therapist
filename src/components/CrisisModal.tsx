import React from 'react';
import { DEFAULT_CRISIS_RESOURCES } from '../constants';

interface CrisisModalProps {
  onClose: () => void;
}

export const CrisisModal: React.FC<CrisisModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border-l-8 border-rose-500">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-rose-100 rounded-full text-rose-600">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900">You are not alone.</h2>
          </div>
          
          <p className="text-slate-600 mb-6">
            It sounds like you might be going through a very difficult time. Sukoon is an AI and cannot provide emergency help. Please reach out to a human who can help you stay safe.
          </p>

          <div className="space-y-3 mb-6">
            {DEFAULT_CRISIS_RESOURCES.map((res, i) => (
              <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-slate-800">{res.name}</div>
                  <div className="text-xs text-slate-500">{res.description}</div>
                </div>
                <a href={`tel:${res.phone.replace(/\D/g,'')}`} className="px-3 py-1 bg-rose-600 text-white text-sm font-bold rounded-full hover:bg-rose-700">
                  Call {res.phone.split(' ')[0]}
                </a>
              </div>
            ))}
          </div>

          <button 
            onClick={onClose}
            className="w-full py-3 text-slate-500 hover:text-slate-800 text-sm font-medium"
          >
            I am safe right now, return to chat
          </button>
        </div>
      </div>
    </div>
  );
};