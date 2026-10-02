
import React, { useState } from 'react';
import { Message, BugReport, UserFeedback } from '../types';

interface FeedbackModalProps {
  mode: 'bug' | 'feedback';
  userId: string;
  sessionId: string;
  contextLogs?: Message[];
  onSubmitBug: (report: Omit<BugReport, 'id' | 'timestamp' | 'status'>) => void;
  onSubmitFeedback: (feedback: Omit<UserFeedback, 'id' | 'timestamp'>) => void;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ mode, userId, sessionId, contextLogs = [], onSubmitBug, onSubmitFeedback, onClose }) => {
  // Bug State
  const [issueType, setIssueType] = useState('Technical Issue');
  const [bugDescription, setBugDescription] = useState('');

  // Feedback State
  const [feedbackType, setFeedbackType] = useState<'Positive' | 'Neutral' | 'Negative'>('Positive');
  const [category, setCategory] = useState('User Experience');
  const [note, setNote] = useState('');

  const handleSubmit = () => {
      if (mode === 'bug') {
          if (!bugDescription) return;
          onSubmitBug({
              userId,
              sessionId,
              issueType: issueType as any,
              description: bugDescription,
              capturedContext: contextLogs,
              deviceInfo: navigator.userAgent,
              browser: getBrowserName(),
              appVersion: '1.0.0',
          });
      } else {
          if (!note) return;
          onSubmitFeedback({
              userId,
              feedbackType,
              category: category as any,
              note
          });
      }
      onClose();
  };

  const getBrowserName = () => {
      if (navigator.userAgent.indexOf("Chrome") !== -1) return "Chrome";
      if (navigator.userAgent.indexOf("Firefox") !== -1) return "Firefox";
      if (navigator.userAgent.indexOf("Safari") !== -1) return "Safari";
      return "Unknown";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-2xl shadow-xl p-6 border border-slate-100 dark:border-navy-800 animate-scale-in">
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            {mode === 'bug' ? (
                <><span className="text-rose-500">🐞</span> Report an Issue</>
            ) : (
                <><span className="text-teal-500">💬</span> Give Feedback</>
            )}
        </h3>

        {mode === 'bug' ? (
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Issue Type</label>
                    <select className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800" value={issueType} onChange={e => setIssueType(e.target.value)}>
                        <option>Technical Issue</option>
                        <option>Wrong Response</option>
                        <option>Slow Response</option>
                        <option>UI/Design Problem</option>
                        <option>Other</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                    <textarea 
                        placeholder="Please describe what happened..." 
                        className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none h-32 resize-none border border-slate-200 dark:border-navy-800"
                        value={bugDescription}
                        onChange={e => setBugDescription(e.target.value)}
                    />
                </div>
                <div className="text-xs text-slate-400 bg-slate-50 dark:bg-navy-950 p-3 rounded-lg">
                    <strong>Auto-Captured:</strong> Device Info, Session ID, Last 5 Messages (for debugging).
                </div>
            </div>
        ) : (
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">How do you feel?</label>
                    <div className="flex gap-2">
                        {['Positive', 'Neutral', 'Negative'].map(type => (
                            <button 
                                key={type}
                                onClick={() => setFeedbackType(type as any)}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${feedbackType === type ? (type === 'Positive' ? 'bg-teal-100 text-teal-700' : type === 'Negative' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700') : 'bg-slate-50 dark:bg-navy-950 text-slate-500'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                    <select className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none border border-slate-200 dark:border-navy-800" value={category} onChange={e => setCategory(e.target.value)}>
                        <option>User Experience</option>
                        <option>Design/UI</option>
                        <option>Features</option>
                        <option>Accuracy of Responses</option>
                        <option>Overall Satisfaction</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Feedback</label>
                    <textarea 
                        placeholder="Tell us what you think..." 
                        className="w-full p-3 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none h-32 resize-none border border-slate-200 dark:border-navy-800"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                    />
                </div>
            </div>
        )}

        <div className="flex gap-3 mt-8">
            <button onClick={onClose} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
            <button 
                onClick={handleSubmit}
                disabled={mode === 'bug' ? !bugDescription : !note}
                className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 disabled:opacity-50"
            >
                Submit
            </button>
        </div>
      </div>
    </div>
  );
};
