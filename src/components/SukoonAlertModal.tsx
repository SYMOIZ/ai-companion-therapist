import React from 'react';

interface SukoonAlertModalProps {
  message: string;
  onClose: () => void;
}

export const SukoonAlertModal: React.FC<SukoonAlertModalProps> = ({ message, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Notice</h2>
        <p className="text-slate-600 mb-6 whitespace-pre-line">{message}</p>
        <button 
          onClick={onClose}
          className="w-full py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};
