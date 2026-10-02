
import React from 'react';

interface EmergencyOverlayProps {
  onClose: () => void;
}

export const EmergencyOverlay: React.FC<EmergencyOverlayProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="bg-rose-500 p-6 text-white text-center">
            <h2 className="text-2xl font-bold mb-2">You Are Valuable.</h2>
            <p className="opacity-90 text-sm">You deserve support from a real human right now.</p>
        </div>
        
        <div className="p-6">
            <p className="text-slate-600 mb-6 text-center leading-relaxed">
                Sukoon is an AI and cannot provide medical care. If you are in pain, feeling hopeless, or want to hurt yourself, please reach out to these free, confidential services immediately.
            </p>

            <div className="space-y-3 mb-8">
                <a href="tel:911" className="flex items-center justify-between bg-rose-50 border border-rose-100 p-4 rounded-xl hover:bg-rose-100 transition-colors group">
                    <div>
                        <div className="font-bold text-rose-700">Emergency Services</div>
                        <div className="text-xs text-rose-500">Immediate danger (911/112)</div>
                    </div>
                    <div className="w-10 h-10 bg-rose-200 text-rose-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </div>
                </a>
                
                <a href="tel:988" className="flex items-center justify-between bg-slate-50 border border-slate-100 p-4 rounded-xl hover:bg-slate-100 transition-colors group">
                    <div>
                        <div className="font-bold text-slate-800">Suicide & Crisis Lifeline</div>
                        <div className="text-xs text-slate-500">Dial 988 (USA/Canada)</div>
                    </div>
                    <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    </div>
                </a>

                <div className="text-center text-xs text-slate-400 mt-2">
                    <a href="https://findahelpline.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-teal-600">
                        Find international helplines here
                    </a>
                </div>
            </div>

            <button 
                onClick={onClose}
                className="w-full py-4 text-slate-500 hover:text-slate-800 text-sm font-medium border-t border-slate-100"
            >
                I am safe right now, return to chat
            </button>
        </div>
      </div>
    </div>
  );
};