
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import { UserSettings } from './types';
import { updateUserProfile } from './services/authService';

import { WelcomePage } from './pages/WelcomePage';
import { ChatPage } from './pages/ChatPage';
import { JournalPage } from './pages/JournalPage';
import { SettingsPage } from './pages/SettingsPage';
import { TherapistDirectory } from './pages/TherapistDirectory';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminBroadcast } from './pages/admin/Broadcast';
import { NotificationsPage } from './pages/NotificationsPage';
import { PlansPage } from './pages/PlansPage';
import { CreditsPage } from './pages/CreditsPage';
import { CrisisPage } from './pages/CrisisPage';
import { StatusPage } from './pages/StatusPage';
import { TherapistDashboard } from './pages/TherapistDashboard';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { SupportPage } from './pages/SupportPage';
import { AboutPage } from './pages/AboutPage';

function App() {
  const [user, setUser] = useState<UserSettings | null>(() => {
    const stored = localStorage.getItem('sukoon_current_user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed?.darkMode) {
          const light = { ...parsed, darkMode: false };
          localStorage.setItem('sukoon_current_user', JSON.stringify(light));
          return light;
        }
        return parsed;
      } catch (e) {
        console.error("Failed to parse stored user", e);
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState(() => {
    const stored = localStorage.getItem('sukoon_current_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.isAdmin) return 'admin-dashboard';
        if (u.role === 'therapist') return 'therapist-overview';
      } catch (e) {
        console.error("Failed to parse stored user for tab", e);
      }
    }
    return 'dashboard';
  });

  useEffect(() => {
    // URL Routing
    const path = window.location.pathname;
    if (path === '/status' || path === '/credits' || path === '/crisis-support') return;
    
    // Sync theme
    if (user?.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [user?.darkMode]);

  const handleUpdateUser = (updated: UserSettings) => {
      setUser(updated);
      if (!updated.is_anonymous) {
        updateUserProfile(updated);
        localStorage.setItem('sukoon_current_user', JSON.stringify(updated));
      }
      if (updated.darkMode) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  };

  const handleLogin = (settings: UserSettings) => {
      const portalUser = { ...settings, darkMode: false };
      handleUpdateUser(portalUser);
      if(portalUser.isAdmin) setActiveTab('admin-dashboard');
      else if (portalUser.role === 'therapist') setActiveTab('therapist-overview');
      else setActiveTab('dashboard');
  };

  const handleLogout = () => {
      localStorage.removeItem('sukoon_current_user');
      localStorage.removeItem('sukoon_auth_token');
      sessionStorage.removeItem('sukoon_client_demo_session');
      sessionStorage.removeItem('sukoon_client_demo_chat');
      sessionStorage.removeItem('sukoon_client_demo_journal');
      setUser(null);
      setActiveTab('dashboard');
  };

  // Standalone Pages
  if (window.location.pathname === '/status') return <StatusPage />;
  if (window.location.pathname === '/credits') return <CreditsPage />;
  if (window.location.pathname === '/crisis-support') return <CrisisPage />;
  if (window.location.pathname === '/about') return <AboutPage />;
  
  const therapistLocked = !!user && user.role === 'therapist' && !user.isAdmin && user.accountStatus !== 'active';
  if (!user || therapistLocked) {
    return <WelcomePage onComplete={handleLogin} initialView={therapistLocked ? 'therapist-pending' : undefined} />;
  }

  return (
    <Layout 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        settings={user}
        onToggleDarkMode={() => handleUpdateUser({...user, darkMode: !user.darkMode})}
        onLogout={handleLogout}
    >
      {user.isAdmin && (
         <div className="h-full w-full">
           {activeTab === 'admin-broadcast' && <AdminBroadcast />}
           {activeTab === 'therapist-dashboard' && <TherapistDashboard view="overview" userId={user.id} />}
           {activeTab.startsWith('admin-') && <AdminDashboard currentView={activeTab} />}
         </div>
      )}

      {user.role === 'therapist' && (
         <div className="h-full w-full">
           {activeTab === 'notifications' && <NotificationsPage userId={user.id} role={user.role === "therapist" ? "therapist" : user.isAdmin ? "admin" : "client"} onNavigate={setActiveTab} />}
           {activeTab === 'settings' && <SettingsPage settings={user} onUpdateSettings={handleUpdateUser} />}
           {activeTab.startsWith('therapist-') && (() => {
               const view = activeTab.replace('therapist-', '');
               return <TherapistDashboard view={view as any} userId={user.id} />;
           })()}
         </div>
      )}

      {!user.isAdmin && user.role !== 'therapist' && (
         <div className="h-full w-full relative">
            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }} className="h-full w-full">
              <DashboardPage settings={user} onNavigate={setActiveTab} />
            </div>
            <div style={{ display: activeTab === 'chat' ? 'block' : 'none' }} className="h-full w-full">
              <ChatPage settings={user} onUpdateUser={handleUpdateUser} onSignUp={handleLogout} onTabChange={setActiveTab} />
            </div>
            <div style={{ display: activeTab === 'journal' ? 'block' : 'none' }} className="h-full w-full">
              <JournalPage userId={user.id} />
            </div>
            <div style={{ display: activeTab === 'directory' ? 'block' : 'none' }} className="h-full w-full">
              <TherapistDirectory onNavigate={setActiveTab} />
            </div>
            <div style={{ display: activeTab === 'support' ? 'block' : 'none' }} className="h-full w-full">
              <SupportPage />
            </div>
            <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }} className="h-full w-full">
              <SettingsPage settings={user} onUpdateSettings={handleUpdateUser} />
            </div>
            <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }} className="h-full w-full">
              <ProfilePage settings={user} onNavigate={setActiveTab} />
            </div>
            <div style={{ display: activeTab === 'plans' ? 'block' : 'none' }} className="h-full w-full">
              <PlansPage settings={user} onUpdateUser={handleUpdateUser} />
            </div>
            <div style={{ display: activeTab === 'notifications' ? 'block' : 'none' }} className="h-full w-full">
              <NotificationsPage userId={user.id} role={(user.role as string) === "therapist" ? "therapist" : user.isAdmin ? "admin" : "client"} onNavigate={setActiveTab} />
            </div>
         </div>
      )}
    </Layout>
  );
}

export default App;
