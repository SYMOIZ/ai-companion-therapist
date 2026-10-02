
import React from 'react';

export const CreditsPage: React.FC = () => {
  return (
    <div className="p-12 max-w-4xl mx-auto font-sans text-slate-800 dark:text-white">
      <h1 className="text-4xl font-bold mb-8">Credits</h1>
      <div className="bg-white dark:bg-navy-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-navy-700 space-y-6">
        <div>
           <h2 className="text-xl font-bold mb-2">Author</h2>
           <p>Syed Moiz (SYMOIZ) — full-stack and AI</p>
        </div>
        <div>
            <h2 className="text-xl font-bold mb-2">Technology Stack</h2>
            <ul className="list-disc ml-5 text-sm text-slate-600 dark:text-slate-400">
                <li>React 19</li>
                <li>Tailwind CSS</li>
                <li>Google Gemini API</li>
            </ul>
        </div>
      </div>
    </div>
  );
};
