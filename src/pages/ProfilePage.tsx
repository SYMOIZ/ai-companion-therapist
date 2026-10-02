import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { isClientDemoAccount, redirectClientDemoToSignup } from '../lib/clientDemo';

interface ProfilePageProps {
  settings: UserSettings;
  onNavigate?: (tab: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ settings, onNavigate }) => {
  const [profileData, setProfileData] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      if (isClientDemoAccount(settings)) {
        if (isMounted) {
          setProfileData({ badges: [], userContext: {} });
          setSubscription(null);
          setPurchaseHistory([]);
          setIsLoading(false);
        }
        return;
      }
      try {
        const token = localStorage.getItem('sukoon_auth_token');
        const headers = { 'Authorization': `Bearer ${token}` };
        
        const res = await fetch('/api/gamification/profile', { headers });
        const json = await res.json();
        
        const uRes = await fetch('/api/auth/user', { headers });
        const uJson = await uRes.json();
        const userContext = uJson.data?.user || {};
        
        const subRes = await fetch('/api/db/select', {
             method: 'POST', headers:{'content-type':'application/json'},
             body: JSON.stringify({table: 'user_subscriptions', filters: [{column: 'user_id', value: settings.id, type: 'eq'}, {column: 'status', value: 'Active', type: 'eq'}]})
        });
        const subData = await subRes.json();
        
        let sub = null;
        if (subData.data && subData.data.length > 0) {
            sub = subData.data[0];
            let pReal = await fetch('/api/db/select', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({table: 'subscription_plans', filters: [{column: 'id', value: sub.plan_id, type: 'eq'}]}) });
            let pData = await pReal.json();
            if (pData.data && pData.data.length > 0) {
                sub = { ...sub, planDetails: pData.data[0] };
            }
        }

        const purRes = await fetch('/api/db/select', {
             method: 'POST', headers:{'content-type':'application/json'},
             body: JSON.stringify({table: 'purchase_history', filters: [{column: 'user_id', value: settings.id, type: 'eq'}], orderCol: 'created_at', orderOpts: {ascending: false} })
        });
        const purData = await purRes.json();

        if (isMounted) {
            setProfileData({ ...json.data, userContext });
            setSubscription(sub);
            if (purData.data) setPurchaseHistory(purData.data);
            setIsLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) setIsLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, [settings.id]);

  if (isLoading) {
    return (
      <div className="p-6 md:p-12 max-w-4xl mx-auto space-y-10 animate-pulse font-sans">
        {/* Banner Shimmer */}
        <div className="h-64 bg-slate-200 dark:bg-navy-800 rounded-3xl" />
        
        {/* Stats Shimmer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-navy-800 rounded-2xl" />
          ))}
        </div>

        {/* Content Box Shimmer */}
        <div className="p-8 rounded-3xl bg-slate-100 dark:bg-navy-800/50 space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-navy-800 rounded w-1/4" />
          <div className="h-4 bg-slate-200 dark:bg-navy-800 rounded w-1/2" />
          <div className="h-4 bg-slate-200 dark:bg-navy-800 rounded w-1/3" />
        </div>
      </div>
    );
  }
  if (!profileData) return <div className="p-12 flex justify-center text-slate-500">Failed to load profile parameters.</div>;

  const totalBadges = profileData.badges?.filter((b: any) => b.earned).length || 0;
  const u = profileData.userContext;

  return (
    <div className="p-6 md:p-12 overflow-y-auto h-full max-w-4xl mx-auto space-y-12">
      {/* Read-Only Profile Banner */}
      <div className="relative rounded-3xl overflow-hidden shadow-sm border border-slate-100 dark:border-navy-700 bg-white dark:bg-navy-800">
          <div className="h-48 bg-gradient-to-r from-teal-400 to-lavender-500 w-full relative"></div>
          
          <div className="px-8 pb-8 pt-16 relative">
             <div className="absolute -top-16 left-8">
                 <div className="w-32 h-32 rounded-full border-4 border-white dark:border-navy-800 bg-slate-200 dark:bg-navy-900 flex items-center justify-center text-5xl font-bold overflow-hidden shadow-lg object-cover">
                    {settings?.name?.charAt(0) || 'U'}
                 </div>
             </div>

             <div className="flex justify-between items-start">
               <div>
                 <div className="flex items-center gap-3">
                   <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{isClientDemoAccount(settings) ? 'Demo Account' : (settings?.name || 'User')}</h1>
                   {isClientDemoAccount(settings) && (
                     <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] uppercase font-bold tracking-widest rounded-full border border-amber-200">
                       Demo Account
                     </span>
                   )}
                   {subscription && subscription.status === 'Active' && (
                     <span className="px-2 py-1 bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300 text-[10px] uppercase font-bold tracking-widest rounded-full border border-teal-200">
                       ✨ Premium Client ✓
                     </span>
                   )}
                 </div>
                 <p className="text-slate-500 dark:text-slate-400 font-medium">{isClientDemoAccount(settings) ? 'demo.client@sukoon.ai' : (settings?.email || u?.email)}</p>
                 <div className="mt-4 flex gap-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                   <div className="bg-slate-50 dark:bg-navy-900 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-navy-700">Account Active</div>
                   <div className="bg-slate-50 dark:bg-navy-900 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-navy-700 font-mono">ID: {settings.id.split('-')[0]}</div>
                 </div>
               </div>
               <div>
                  {(!subscription || subscription.status !== 'Active') && onNavigate && (
                    <button onClick={() => { if (redirectClientDemoToSignup(settings)) return; onNavigate('plans'); }} className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 shadow-md text-white rounded-lg font-bold text-sm transition-all">
                      Upgrade Plan
                    </button>
                  )}
               </div>
             </div>
          </div>
      </div>

      {/* Subscription Status */}
      <div className="p-8 rounded-3xl bg-white dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
           <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">💎 Subscription & Billing</h2>
           {subscription ? (
               <div className="flex flex-col md:flex-row justify-between gap-6">
                   <div className="flex flex-col gap-2 flex-1">
                       <span className="text-slate-500 font-medium">Current Plan</span>
                       <span className="font-bold text-lg text-teal-600">{subscription.planDetails?.name || 'Unknown Plan'}</span>
                   </div>
                   <div className="flex flex-col gap-2 flex-1">
                       <span className="text-slate-500 font-medium">Status</span>
                       <span className={`font-bold text-lg ${subscription.status === 'Active' ? 'text-green-600' : 'text-rose-500'}`}>{subscription.status}</span>
                   </div>
                   <div className="flex flex-col gap-2 flex-1">
                       <span className="text-slate-500 font-medium">Expiry Date</span>
                       <span className="font-bold text-lg text-slate-800 dark:text-white">{new Date(subscription.expiry_date).toLocaleDateString()}</span>
                   </div>
                   {subscription.planDetails?.is_lifetime === 0 && (
                       <div className="flex flex-col gap-2 flex-1">
                           <span className="text-slate-500 font-medium">Renewal Date</span>
                           <span className="font-bold text-lg text-slate-800 dark:text-white">
                               {subscription.renewal_date ? new Date(subscription.renewal_date).toLocaleDateString() : 'N/A'}
                           </span>
                       </div>
                   )}
               </div>
           ) : (
               <div className="text-slate-500 italic">You are currently on the Free plan. Upgrade in Plans & Billing to unlock premium features.</div>
           )}

           {purchaseHistory.length > 0 && (
               <div className="mt-8">
                   <h3 className="text-md font-bold text-slate-700 dark:text-slate-300 mb-4">Purchase History</h3>
                   <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 dark:bg-navy-900 text-slate-500 uppercase">
                               <tr>
                                   <th className="p-3">Date</th>
                                   <th className="p-3">Amount</th>
                                   <th className="p-3">Status</th>
                               </tr>
                           </thead>
                           <tbody>
                               {purchaseHistory.slice(0,5).map((pur, i) => (
                                   <tr key={i} className="border-t border-slate-100 dark:border-navy-700">
                                       <td className="p-3 text-slate-600 dark:text-slate-300">{new Date(pur.created_at).toLocaleDateString()}</td>
                                       <td className="p-3 font-medium text-slate-800 dark:text-white">PKR {pur.amount.toLocaleString()}</td>
                                       <td className="p-3">
                                           <span className={`px-2 py-1 rounded text-xs font-bold ${pur.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{pur.status}</span>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   </div>
               </div>
           )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-6 rounded-2xl bg-white dark:bg-navy-800 border border-slate-100 dark:border-navy-700 text-center">
            <div className="text-3xl mb-1">📝</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">{profileData.stats?.journal_count || 0}</div>
            <div className="text-xs uppercase font-bold text-slate-400">Journal Entries</div>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-navy-800 border border-slate-100 dark:border-navy-700 text-center">
            <div className="text-3xl mb-1">💬</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">{profileData.stats?.therapy_count || 0}</div>
            <div className="text-xs uppercase font-bold text-slate-400">Therapy Sessions</div>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-navy-800 border border-slate-100 dark:border-navy-700 text-center">
            <div className="text-3xl mb-1">🎭</div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">{profileData.stats?.mood_tracked || 0}</div>
            <div className="text-xs uppercase font-bold text-slate-400">Moods Tracked</div>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-navy-800 border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-900/10 text-center">
            <div className="text-3xl mb-1">🏆</div>
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{profileData.reward_points || 0}</div>
            <div className="text-xs uppercase font-bold text-teal-600 dark:text-teal-400">Reward Points</div>
        </div>
      </div>

      {/* Referral System */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-lavender-500 to-indigo-600 text-white flex flex-col md:flex-row items-center justify-between gap-8">
         <div className="flex-1">
             <h2 className="text-2xl font-bold mb-2">Refer a Friend</h2>
             <p className="text-white/80">Give your friends 100 Reward Points on signup, and get 100 points for yourself when they join!</p>
         </div>
         <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-md flex flex-col items-center border border-white/20 min-w-[250px]">
             <div className="text-sm font-medium text-white/70 mb-2 uppercase tracking-wide">Your Referral Code</div>
             <div className="text-3xl font-mono font-bold tracking-widest">{profileData.referral_code || 'N/A'}</div>
             <button onClick={() => {navigator.clipboard.writeText(profileData.referral_code); alert("Copied!")}} className="mt-4 px-4 py-2 bg-white text-indigo-600 rounded-lg text-sm font-bold w-full hover:bg-slate-50">
                 Copy Code
             </button>
         </div>
      </div>

      {/* Leaderboard (Private Ranking) */}
      <div className="p-8 rounded-3xl bg-white dark:bg-navy-800 border border-slate-100 dark:border-navy-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            📊 Progress Status
            <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-navy-900 px-2 py-1 rounded bg-slate-100">(Private)</span>
          </h2>
          <div className="flex flex-col gap-4">
             <div className="flex justify-between items-center py-4 border-b border-slate-100 dark:border-navy-700">
               <span className="text-slate-500 font-medium">Your Rank Level</span>
               <span className="font-bold text-lg text-slate-800 dark:text-white">
                 {profileData.reward_points > 1000 ? 'Platinum' : profileData.reward_points > 500 ? 'Gold' : profileData.reward_points > 100 ? 'Silver' : 'Bronze'}
               </span>
             </div>
             <div className="flex justify-between items-center py-4 border-b border-slate-100 dark:border-navy-700">
               <span className="text-slate-500 font-medium">Total Badges</span>
               <span className="font-bold text-lg text-slate-800 dark:text-white">{totalBadges} / {profileData.badges?.length || 8}</span>
             </div>
             <div className="flex justify-between items-center py-4">
               <span className="text-slate-500 font-medium">Reward Points</span>
               <span className="font-bold text-lg text-teal-600">{profileData.reward_points} RP</span>
             </div>
          </div>
      </div>

      {/* Badges Collection */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Badge Collection</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {profileData.badges?.map((badge: any) => (
                <div 
                  key={badge.id}
                  className={`p-6 rounded-2xl border flex flex-col items-center text-center transition-all ${
                      badge.earned 
                      ? 'bg-white dark:bg-navy-800 border-yellow-200 dark:border-yellow-900/30 bg-gradient-to-b from-white to-amber-50/30' 
                      : 'bg-slate-50 dark:bg-navy-900 border-slate-100 dark:border-navy-800 opacity-60 grayscale'
                  }`}
                >
                    <div className="text-4xl mb-3">{badge.icon || '🏅'}</div>
                    <div className="font-bold text-slate-800 dark:text-white">{badge.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">{badge.description}</div>
                    {badge.earned && (
                        <div className="mt-3 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 text-[10px] rounded-full font-bold uppercase tracking-widest">
                            Unlocked
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>

    </div>
  );
};

