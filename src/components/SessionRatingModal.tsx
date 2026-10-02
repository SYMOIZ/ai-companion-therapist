import React, { useState } from 'react';
import { SessionRating } from '../types';

interface SessionRatingModalProps {
  sessionId: string;
  onSubmit: (rating: SessionRating) => void;
  onClose: () => void;
}

export const SessionRatingModal: React.FC<SessionRatingModalProps> = ({ sessionId, onSubmit, onClose }) => {
  const [rating, setRating] = useState(0);
  const [remark, setRemark] = useState('');

  const handleSubmit = () => {
    if (rating === 0) return;
    onSubmit({
        id: crypto.randomUUID(),
        sessionId,
        rating,
        remark,
        timestamp: Date.now()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-navy-900 w-full max-w-sm rounded-2xl shadow-xl p-6 border border-slate-100 dark:border-navy-800 animate-scale-in">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-2">How was your session?</h3>
        <p className="text-center text-slate-500 dark:text-slate-400 text-sm mb-6">Your feedback is private and helps us improve.</p>

        <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                >
                    <svg 
                        className={`w-10 h-10 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-slate-200 dark:text-navy-700'}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                </button>
            ))}
        </div>

        <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Any additional thoughts? (Optional)"
            className="w-full bg-slate-50 dark:bg-navy-950 p-3 rounded-xl text-sm outline-none mb-6 text-slate-700 dark:text-slate-300 placeholder-slate-400 h-24 resize-none"
        />

        <div className="flex gap-3">
            <button 
                onClick={onClose}
                className="flex-1 py-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium"
            >
                Skip
            </button>
            <button 
                onClick={handleSubmit}
                disabled={rating === 0}
                className="flex-1 py-3 bg-lavender-500 text-white rounded-xl font-bold shadow-lg shadow-lavender-200 disabled:opacity-50 disabled:shadow-none hover:bg-lavender-600 transition-all"
            >
                Submit
            </button>
        </div>
      </div>
    </div>
  );
};