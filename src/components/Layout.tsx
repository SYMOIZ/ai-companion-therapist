
import React, { useState, useRef, useEffect } from 'react';
import { UserSettings, Broadcast } from '../types';
import { getActiveBroadcasts, getUserNotifications, markNotificationRead, markAllNotificationsRead, getActiveUserRiskAlerts } from '../services/dataService';
import { isClientDemoAccount, redirectClientDemoToSignup, CLIENT_DEMO_USER_ID } from '../lib/clientDemo';
import { motion, AnimatePresence } from 'motion/react';
import { RiskAlert } from '../types';
import { 
  Menu, X, Bell, MessageSquare, User, Sun, Moon, LogOut, 
  LayoutDashboard, Users, ShieldCheck, Radio, Link, Users2,
  Heart, FileText, Settings, MessageCircle, Info, HelpCircle,
  CreditCard
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: any) => void;
  settings: UserSettings;
  onToggleDarkMode: () => void;
  onLogout: () => void;
}

const getNotificationRoute = (title: string, role: string) => {
    const t = title.toLowerCase();
    if (role === 'admin') {
         if (t.includes('therapist') && (t.includes('application') || t.includes('setup'))) return 'admin-therapists';
         if (t.includes('payment') || t.includes('deposit') || t.includes('boost')) return 'admin-finance';
         return 'admin-support';
    } else if (role === 'therapist') {
         if (t.includes('booking request') || t.includes('booking')) return 'therapist-calendar';
         if (t.includes('reschedule')) return 'therapist-calendar';
         if (t.includes('message')) return 'therapist-patients';
         if (t.includes('admin') || t.includes('system')) return 'therapist-support';
         return 'notifications';
    } else {
         if (t.includes('booking approved') || t.includes('booking rejected') || t.includes('reschedule')) return 'journal';
         if (t.includes('message')) return 'chat';
         if (t.includes('admin') || t.includes('support')) return 'support';
         return 'notifications';
    }
};

const NotificationMenu = ({ role, userId, onClose, onNavigate, onMarkReadSync }: { role: string, userId: string, onClose: () => void, onNavigate: (tab: string) => void, onMarkReadSync: () => void }) => {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        if (userId === CLIENT_DEMO_USER_ID) {
          setNotifications([]);
          setLoading(false);
          return;
        }
        getUserNotifications().then(async data => {
            if (isMounted) {
                // If there are unread loaded, we mark them all as read.
                const hasUnread = data.some(n => !n.isRead);
                setNotifications(data.map(n => ({...n, isRead: true})));
                setLoading(false);
                
                if (hasUnread && userId) {
                    onMarkReadSync();
                    await markAllNotificationsRead(userId);
                }
            }
        });
        return () => { isMounted = false; };
    }, [userId]);

    const handleItemClick = async (n: any) => {
        onNavigate(getNotificationRoute(n.title, role));
        onClose();
    };

    return (
        <div className="absolute right-0 top-12 w-80 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-100 dark:border-navy-700 overflow-hidden z-50 animate-fade-in">
            <div className="p-3 border-b border-slate-100 dark:border-navy-700 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Notifications</h3>
            </div>
            <div className="max-h-64 overflow-y-auto">
                {loading ? (
                    <div className="p-6 text-center text-xs text-slate-400 flex justify-center items-center">Loading alerts...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 italic">No notifications</div>
                ) : (
                    notifications.map(n => (
                        <div 
                            key={n.id} 
                            onClick={() => handleItemClick(n)}
                            className={`p-3 border-b border-slate-50 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors cursor-pointer ${!n.isRead ? 'bg-teal-50/50 dark:bg-navy-900/50' : ''}`}
                        >
                            <div className="flex gap-3">
                                <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${!n.isRead ? 'bg-rose-500' : 'bg-slate-300'}`}></div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{n.title}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                                    <p className="text-[9px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="p-2 text-center border-t border-slate-100 dark:border-navy-700">
                <button onClick={() => { onNavigate('notifications'); onClose(); }} className="text-xs font-bold text-teal-600 hover:underline">
                    View All
                </button>
            </div>
        </div>
    );
};

const ChatMenu = ({ role, onClose, onNavigate }: { role: string, onClose: () => void, onNavigate: (tab: string) => void }) => {
    let items = [];
    if (role === 'admin') items = [{ label: 'Therapist Support Tickets', icon: '🎫' }, { label: 'Client Help Requests', icon: '🙋' }];
    else if (role === 'therapist') items = [{ label: 'My Clients', icon: '👥' }, { label: 'Admin Hotline', icon: '🔥' }];
    else items = [{ label: 'My Therapist', icon: '🩺' }, { label: 'Support / Admin', icon: '🛡️' }];

    const handleItemClick = (label: string) => {
        if (role === 'therapist') {
            if (label === 'My Clients') onNavigate('therapist-patients');
            else if (label === 'Admin Hotline') onNavigate('therapist-support');
        } else if (role === 'admin') {
             // Updated navigation for Admin
             if (label === 'Therapist Support Tickets') onNavigate('admin-support');
             else if (label === 'Client Help Requests') onNavigate('admin-support');
             else onNavigate('admin-messages'); 
        } else {
             if (label === 'My Therapist') onNavigate('chat');
             else onNavigate('support');
        }
        onClose();
    };

    return (
        <div className="absolute right-0 top-12 w-64 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-100 dark:border-navy-700 overflow-hidden z-50 animate-fade-in">
            <div className="p-3 border-b border-slate-100 dark:border-navy-700">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Messages & Support</h3>
            </div>
            <div>
                {items.map((item, idx) => (
                    <button 
                        key={idx} 
                        onClick={() => handleItemClick(item.label)}
                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors flex items-center gap-3"
                    >
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const NavItem = ({ icon, label, isActive, onClick, badge }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void, badge?: number }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative ${
      isActive 
        ? 'bg-teal-50 dark:bg-navy-800 text-teal-600 dark:text-teal-400 font-bold shadow-sm' 
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-900 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
    }`}
  >
    <div className={`${isActive ? 'text-teal-600' : 'text-slate-400'}`}>{icon}</div>
    <span className="whitespace-nowrap">{label}</span>
    {badge && badge > 0 ? (
        <span className="absolute right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">{badge}</span>
    ) : null}
  </button>
);

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, settings, onToggleDarkMode, onLogout }) => {
  const isAdmin = settings.isAdmin;
  const isTherapist = settings.role === 'therapist';
  const role = isAdmin ? 'admin' : isTherapist ? 'therapist' : 'client';

  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const headerRef = useRef<HTMLDivElement>(null);

  const [hasPremium, setHasPremium] = useState(false);
  
  // Fetch Broadcasts & Unread Count Periodic Sync
  useEffect(() => {
      // 1. Fetch Banner Broadcasts
      if (settings && !isAdmin) {
          getActiveBroadcasts(settings).then(broadcasts => {
              // Only critical banners
              const banner = broadcasts.find(b => b.type === 'critical');
              setBroadcast(banner || null);
          });
      }

      // 2. Fetch Notification Count
      const updateUnread = () => {
          if (isClientDemoAccount(settings)) {
            setUnreadCount(0);
            return;
          }
          getUserNotifications().then(notifs => {
              const unread = notifs.filter(n => !n.isRead).length;
              setUnreadCount(unread);
          });
      };

      // 3. Fetch Premium Status
      if (settings && !isAdmin && !isTherapist) {
          fetch('/api/db/select', {
             method: 'POST', headers:{'content-type':'application/json'},
             body: JSON.stringify({table: 'user_subscriptions', filters: [{column: 'user_id', value: settings.id, type: 'eq'}, {column: 'status', value: 'Active', type: 'eq'}]})
          }).then(r => r.json()).then(data => {
             if (data.data && data.data.length > 0) {
                 setHasPremium(true);
             }
          }).catch(() => {});
      }

      updateUnread();
      const interval = setInterval(updateUnread, 3000);
      return () => clearInterval(interval);
  }, [settings, activeTab, isAdmin, isTherapist]);

  // Close menus on click outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
              setShowChatMenu(false);
              setShowNotifMenu(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setIsSidebarOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center gap-3 justify-start border-b border-lavender-150 dark:border-navy-900 pb-4">
        <img 
          src="/sukoon-logo.png" 
          alt="Sukoon" 
          className="h-8 md:h-10 lg:h-12 w-auto object-contain select-none shrink-0 block" 
        />
        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden ml-auto p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 w-full space-y-1 px-2 py-4 overflow-y-auto scrollbar-hide">
        {isAdmin ? (
            <>
            <NavItem 
                icon={<LayoutDashboard size={20} />}
                label="Dashboard" 
                isActive={activeTab === 'admin-dashboard'} 
                onClick={() => handleTabChange('admin-dashboard')} 
            />
            <NavItem 
                icon={<Users size={20} />}
                label="Therapists" 
                isActive={activeTab === 'admin-therapists'} 
                onClick={() => handleTabChange('admin-therapists')} 
            />
            <NavItem 
                icon={<MessageSquare size={20} />}
                label="Messages" 
                isActive={activeTab === 'admin-messages'} 
                onClick={() => handleTabChange('admin-messages')} 
            />
            <NavItem 
                icon={<ShieldCheck size={20} />}
                label="Support & Feedback" 
                isActive={activeTab === 'admin-support'} 
                onClick={() => handleTabChange('admin-support')} 
            />
            <NavItem 
                icon={<Users2 size={20} />}
                label="User Base" 
                isActive={activeTab === 'admin-users'} 
                onClick={() => handleTabChange('admin-users')} 
            />
            <NavItem 
                icon={<Link size={20} />}
                label="Finance" 
                isActive={activeTab === 'admin-finance'} 
                onClick={() => handleTabChange('admin-finance')} 
            />
            <NavItem 
                icon={<ShieldCheck size={20} />}
                label="Subscriptions" 
                isActive={activeTab === 'admin-subscriptions'} 
                onClick={() => handleTabChange('admin-subscriptions')} 
            />
            <NavItem 
                icon={<Radio size={20} />}
                label="Broadcasts" 
                isActive={activeTab === 'admin-broadcast'} 
                onClick={() => handleTabChange('admin-broadcast')} 
            />
            <NavItem 
                icon={<Link size={20} />}
                label="Connections" 
                isActive={activeTab === 'admin-connections'} 
                onClick={() => handleTabChange('admin-connections')} 
            />
            <NavItem 
                icon={<Users size={20} />}
                label="Team Access" 
                isActive={activeTab === 'admin-team'} 
                onClick={() => handleTabChange('admin-team')} 
            />
            </>
        ) : isTherapist ? (
            <>
            <NavItem 
                icon={<LayoutDashboard size={20} />}
                label="My Practice" 
                isActive={activeTab === 'therapist-overview'} 
                onClick={() => handleTabChange('therapist-overview')} 
            />
            <NavItem 
                icon={<Bell size={20} />}
                label="Notifications" 
                isActive={activeTab === 'notifications'} 
                onClick={() => handleTabChange('notifications')} 
                badge={unreadCount}
            />
            <NavItem 
                icon={<LayoutDashboard size={20} />}
                label="Calendar" 
                isActive={activeTab === 'therapist-calendar'} 
                onClick={() => handleTabChange('therapist-calendar')}
            />
            <NavItem 
                icon={<Users size={20} />}
                label="My Patients" 
                isActive={activeTab === 'therapist-patients'} 
                onClick={() => handleTabChange('therapist-patients')} 
            />
            <NavItem 
                icon={<Link size={20} />}
                label="My Wallet" 
                isActive={activeTab === 'therapist-finance'} 
                onClick={() => handleTabChange('therapist-finance')} 
            />
            <NavItem 
                icon={<ShieldCheck size={20} />}
                label="Reputation" 
                isActive={activeTab === 'therapist-analytics'} 
                onClick={() => handleTabChange('therapist-analytics')} 
            />
            <NavItem 
                icon={<Settings size={20} />}
                label="Settings" 
                isActive={activeTab === 'settings'} 
                onClick={() => handleTabChange('settings')} 
            />
            </>
        ) : (
            <>
            <NavItem 
                icon={<MessageCircle size={20} />}
                label="Chat" 
                isActive={activeTab === 'chat'} 
                onClick={() => handleTabChange('chat')} 
            />
            <NavItem 
                icon={<FileText size={20} />}
                label="Mood Tracking" 
                isActive={activeTab === 'journal'} 
                onClick={() => handleTabChange('journal')} 
            />
            <NavItem 
                icon={<Users size={20} />}
                label="Therapists" 
                isActive={activeTab === 'directory'} 
                onClick={() => handleTabChange('directory')} 
            />
            <NavItem 
                icon={<Heart size={20} />}
                label="Tickets & Support" 
                isActive={activeTab === 'support'} 
                onClick={() => { if (redirectClientDemoToSignup(settings)) return; handleTabChange('support'); }} 
            />
            <NavItem 
                icon={<Bell size={20} />}
                label="Notifications" 
                isActive={activeTab === 'notifications'} 
                onClick={() => handleTabChange('notifications')} 
                badge={unreadCount}
            />
            <NavItem 
                icon={<Settings size={20} />}
                label="Settings" 
                isActive={activeTab === 'settings'} 
                onClick={() => handleTabChange('settings')} 
            />
            <NavItem 
                icon={<User size={20} />}
                label="Profile" 
                isActive={activeTab === 'profile'} 
                onClick={() => handleTabChange('profile')} 
            />
            </>
        )}
      </nav>
      
      <div className="p-4 border-t border-lavender-200 dark:border-navy-800 space-y-2">
        {!isAdmin && !isTherapist && (
          <div className="mb-4">
            {hasPremium ? (
              <div className="px-3 py-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-navy-900 dark:to-orange-950/20 border border-amber-200 dark:border-orange-900/30 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400 shadow-sm">
                <span className="text-sm">👑</span>
                <span>Premium Client</span>
              </div>
            ) : (
              <div className="p-3 bg-gradient-to-br from-indigo-50 to-teal-50 dark:from-navy-900/40 dark:to-teal-950/30 border border-dashed border-teal-200 dark:border-teal-900/50 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-400">
                  <span>⭐</span>
                  <span>Upgrade to Pro</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Unlock unlimited AI chats, priority therapist matches, and all premium features.
                </p>
                <button 
                  onClick={() => { if (redirectClientDemoToSignup(settings)) return; handleTabChange('settings'); }}
                  className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm"
                >
                  View Plans
                </button>
              </div>
            )}
          </div>
        )}
        <button 
            onClick={onToggleDarkMode} 
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900 rounded-lg transition-colors"
            title="Toggle Theme"
        >
            {settings.darkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span className="text-sm font-medium">Theme</span>
        </button>
        <button 
            onClick={onLogout} 
            className="w-full flex items-center gap-3 px-4 py-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
            title="Logout"
        >
            <LogOut size={20} />
            <span className="text-sm font-bold">Logout</span>
        </button>

        <div className="pt-4 flex flex-wrap justify-between gap-x-2 gap-y-2 px-2">
            <a href="/terms" className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Terms</a>
            <a href="/privacy" className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Privacy</a>
            <a href="/cookie" className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Cookies</a>
            <a href="/community" className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Community</a>
            <a href="/about" className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">About</a>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`flex h-screen ${settings.darkMode ? 'dark' : ''} bg-beige-50 dark:bg-navy-900 overflow-hidden transition-colors duration-300`}>
      {/* Block Mobile Access for Admin */}
      {isAdmin && (
        <div className="lg:hidden fixed inset-0 bg-white dark:bg-navy-950 flex flex-col items-center justify-center p-8 z-[9999] text-center font-sans">
          <div className="w-20 h-20 bg-teal-50 dark:bg-teal-950/40 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm animate-bounce">🖥️</div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-3">Desktop Access Only</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-6">
            The Admin Dashboard is designed and optimized for desktop devices only to ensure high-security management and data consistency.
          </p>
          <div className="text-xs text-slate-405 font-mono tracking-wider">Sukoon Administrator Console</div>
        </div>
      )}
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 bg-white dark:bg-navy-950 flex-col border-r border-lavender-200 dark:border-navy-800 shrink-0 shadow-sm z-20 transition-all duration-300">
          {sidebarContent}
      </aside>

      {/* Sidebar - Mobile Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-navy-950 z-[70] lg:hidden shadow-2xl border-r border-lavender-200 dark:border-navy-800"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-hidden relative flex flex-col">
          
          {/* Admin Broadcast Bar */}
          {broadcast && (
              <div className={`w-full px-4 py-2 flex justify-between items-center shadow-sm z-40 transition-colors ${
                  broadcast.type === 'critical' ? 'bg-rose-600 text-white' : 
                  broadcast.type === 'warning' ? 'bg-amber-100 text-amber-800 border-b border-amber-200' : 
                  'bg-indigo-600 text-white'
              }`}>
                  <div className="flex items-center gap-3">
                      <span className="text-lg animate-pulse">{broadcast.type === 'critical' ? '🚨' : broadcast.type === 'warning' ? '⚠️' : '📢'}</span>
                      <div className="text-sm font-medium">
                          <span className="font-bold mr-2 uppercase tracking-wide">{broadcast.title}:</span>
                          {broadcast.message}
                      </div>
                  </div>
                  <div className="flex items-center gap-4">
                     <button onClick={() => setBroadcast(null)} className="opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
                  </div>
              </div>
          )}


          {/* Global TopBar */}
          <div className="h-16 border-b border-slate-100 dark:border-navy-800 bg-white/80 dark:bg-navy-950/80 backdrop-blur-md flex justify-between items-center px-4 lg:px-6 shrink-0 z-40" ref={headerRef}>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="lg:hidden p-2 text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                  <Menu size={24} />
                </button>
                <h1 className="font-bold text-base lg:text-lg text-slate-800 dark:text-white capitalize truncate max-w-[150px] lg:max-w-none">
                    {activeTab.replace(/-/g, ' ').replace('therapist ', '')}
                </h1>
              </div>
              
              <div className="flex items-center gap-2 lg:gap-4">
                  {/* Chat Action */}
                  <div className="relative">
                      <button 
                        onClick={() => { setShowChatMenu(!showChatMenu); setShowNotifMenu(false); }} 
                        className="p-2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors relative"
                      >
                          <MessageSquare size={22} />
                      </button>
                      {showChatMenu && <ChatMenu role={role} onClose={() => setShowChatMenu(false)} onNavigate={onTabChange} />}
                  </div>

                  {/* Notification Action (Bell) */}
                  <div className="relative">
                      <button 
                        onClick={() => { setShowNotifMenu(!showNotifMenu); setShowChatMenu(false); }} 
                        className="p-2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors relative"
                        id="bell-notification-btn"
                      >
                          <Bell size={22} />
                          {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-navy-950"></span>}
                      </button>
                      {showNotifMenu && <NotificationMenu role={role} userId={settings.id} onClose={() => setShowNotifMenu(false)} onNavigate={handleTabChange} onMarkReadSync={() => setUnreadCount(0)} />}
                  </div>

                  {/* Profile Avatar */}
                  <button onClick={() => onTabChange(isTherapist ? 'therapist-profile' : 'profile')} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs overflow-hidden border border-slate-100 dark:border-navy-700">
                      {settings?.name?.charAt(0) || 'U'}
                  </button>
              </div>
          </div>

          <div className={`flex-1 overflow-hidden relative ${isAdmin ? '' : 'pb-16 lg:pb-0'}`}>
            {children}
          </div>

          {/* Bottom Nav - Mobile Only */}
          {!isAdmin && (
            <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-navy-950/95 backdrop-blur-md border-t border-slate-200/60 dark:border-navy-900 flex justify-around items-center z-50 px-2 pb-safe shadow-[0_-4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.2)]">
              {isTherapist ? (
                <>
                  <button 
                    onClick={() => handleTabChange('therapist-overview')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'therapist-overview' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <LayoutDashboard size={18} className={activeTab === 'therapist-overview' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Practice</span>
                  </button>
                  <button 
                    onClick={() => handleTabChange('therapist-calendar')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'therapist-calendar' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <FileText size={18} className={activeTab === 'therapist-calendar' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Calendar</span>
                  </button>
                  <button 
                    onClick={() => handleTabChange('therapist-patients')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'therapist-patients' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <Users size={18} className={activeTab === 'therapist-patients' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Patients</span>
                  </button>
                  <button 
                    onClick={() => handleTabChange('therapist-finance')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'therapist-finance' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <CreditCard size={18} className={activeTab === 'therapist-finance' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Wallet</span>
                  </button>
                  <button 
                    onClick={() => handleTabChange('settings')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'settings' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <Settings size={18} className={activeTab === 'settings' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Settings</span>
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => handleTabChange('chat')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'chat' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <MessageCircle size={18} className={activeTab === 'chat' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Chat</span>
                  </button>
                  <button 
                    onClick={() => handleTabChange('journal')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'journal' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <FileText size={18} className={activeTab === 'journal' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Mood</span>
                  </button>
                  <button 
                    onClick={() => handleTabChange('directory')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'directory' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <Users size={18} className={activeTab === 'directory' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Therapists</span>
                  </button>
                  <button 
                    onClick={() => handleTabChange('support')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'support' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <Heart size={18} className={activeTab === 'support' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Support</span>
                  </button>
                  <button 
                    onClick={() => handleTabChange('profile')}
                    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${activeTab === 'profile' ? 'text-teal-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 dark:text-slate-500 hover:text-slate-500'}`}
                  >
                    <User size={18} className={activeTab === 'profile' ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
                    <span className="text-[9px] mt-1 font-medium tracking-tight">Profile</span>
                  </button>
                </>
              )}
            </div>
          )}
      </main>

    </div>
  );
};

export default Layout;
