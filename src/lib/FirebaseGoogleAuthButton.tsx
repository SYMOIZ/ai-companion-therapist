import React from 'react';
import { loginWithGoogle } from './firebase';

interface Props {
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
  type: 'login' | 'signup';
}

export const FirebaseGoogleAuthButton: React.FC<Props> = ({ onSuccess, onError, type }) => {
  const handleGoogleLogin = async () => {
    try {
      const user = await loginWithGoogle();
      
      // Call backend API
      const endpoint = type === 'login' ? '/api/auth/login_google' : '/api/auth/signup_google';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          displayName: user.displayName,
        }),
      });
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error.message);
      }
      // Combine user and settings-like fields if necessary, or just pass user. 
      // handleLogin in App.tsx takes user settings.
      // Let's pass the user object, and let the backend return everything we need, or extend in backend.
      const userData = { ...data.data.user, stats: { totalActiveDays: 0, badges: [] } };
      onSuccess(userData);
    } catch (e: any) {
      onError(e.message);
    }
  };

  return (
    <button
      onClick={handleGoogleLogin}
      className="w-full flex items-center justify-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
    >
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
      <span className="font-bold text-slate-700">Continue with Google</span>
    </button>
  );
};
