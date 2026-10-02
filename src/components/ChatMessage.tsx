import React, { useRef, useEffect, useState } from 'react';
import { Message, MessageRole } from '../types';

interface ChatMessageProps {
  message: Message;
  onPlayAudio?: (base64: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onPlayAudio }) => {
  const isUser = message.role === MessageRole.USER;
  const isSystem = message.role === MessageRole.SYSTEM;
  
  if (isSystem && message.referralTherapists) {
      return (
          <div className="flex w-full mb-8 justify-center animate-fade-in">
              <div className="w-full max-w-lg bg-teal-50 dark:bg-navy-800 border border-teal-100 dark:border-teal-900 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center text-xl">🛡️</div>
                      <div>
                          <h3 className="font-bold text-slate-800 dark:text-white text-sm">Message from Support Team</h3>
                          <div className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider">Priority Intervention</div>
                      </div>
                  </div>
                  
                  <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
                      {typeof message.text === 'string' ? message.text : '(System message error)'}
                  </p>

                  <div className="space-y-3">
                      {message.referralTherapists.map((therapist) => (
                          <div key={therapist.id} className="bg-white dark:bg-navy-950 p-4 rounded-xl border border-slate-100 dark:border-navy-700 flex justify-between items-center shadow-sm">
                              <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-navy-800 flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                                      {therapist.imageUrl ? <img src={therapist.imageUrl} alt={therapist.name} className="w-full h-full object-cover" /> : therapist.name?.charAt(0) || 'T'}
                                  </div>
                                  <div>
                                      <div className="font-bold text-slate-800 dark:text-white text-sm">{therapist.name}</div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">{therapist.specialty}</div>
                                      <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold mt-0.5">
                                          <span>⭐ {therapist.rating || 4.9}</span>
                                          <span className="text-slate-300">({therapist.reviewCount || 20}+ Reviews)</span>
                                      </div>
                                  </div>
                              </div>
                              <a 
                                  href={therapist.bookingUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 shadow-md transition-transform hover:scale-105"
                              >
                                  Book Priority
                              </a>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
        
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
          isUser 
            ? 'bg-slate-700 dark:bg-navy-700 text-white' 
            : 'bg-teal-600 dark:bg-teal-700 text-white'
        }`}>
          {isUser ? 'ME' : 'A'}
        </div>

        {/* Bubble */}
        <div className={`relative px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
          isUser 
            ? 'bg-slate-800 dark:bg-teal-900/30 text-slate-50 dark:text-teal-50 border border-transparent dark:border-teal-800/30 rounded-br-none' 
            : 'bg-white dark:bg-navy-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-navy-700 rounded-bl-none'
        }`}>
          {/* FIX: Validate message text is a string before rendering */}
          <div className="whitespace-pre-wrap font-sans" dir="auto">
              {typeof message.text === 'string' ? message.text : '(Invalid message format)'}
          </div>
          
          {/* Grounding / Maps Links */}
          {message.groundingLinks && message.groundingLinks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-navy-700">
               <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 block">References</span>
               <div className="flex flex-col gap-1">
                 {message.groundingLinks.map((link, i) => (
                   <a 
                    key={i} 
                    href={link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                   >
                     <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     View on Google Maps
                   </a>
                 ))}
               </div>
            </div>
          )}

          {/* Audio Player Control */}
          {!isUser && message.audioBase64 && (
            <button 
              onClick={() => onPlayAudio?.(message.audioBase64!)}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              Play Voice
            </button>
          )}

          {/* Timestamp */}
          <div className={`text-[10px] mt-2 opacity-50 ${isUser ? 'text-slate-300 dark:text-teal-200/50' : 'text-slate-400 dark:text-slate-500'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </div>
    </div>
  );
};