import React, { useState, useEffect } from 'react';
import { 
  getTherapists, 
  createSessionBooking, 
  getSessionBookings, 
  createNotification 
} from '../services/dataService';
import { Therapist, SessionBooking, UserSettings } from '../types';
import { isClientDemoAccount, redirectClientDemoToSignup } from '../lib/clientDemo';
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  Upload, 
  Check, 
  MapPin, 
  Award, 
  DollarSign, 
  Video, 
  Mic, 
  MessageSquare, 
  ChevronRight, 
  User, 
  ShieldCheck, 
  ListRestart, 
  TrendingUp, 
  FileText 
} from 'lucide-react';

export const TherapistDirectory: React.FC<{onNavigate?: (tab: string) => void}> = ({ onNavigate }) => {
  const [currentUser, setCurrentUser] = useState<UserSettings | null>(() => {
    const stored = localStorage.getItem('sukoon_current_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [sessionBookings, setSessionBookings] = useState<SessionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [limits, setLimits] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'directory' | 'my-bookings'>(() => {
    return (localStorage.getItem('sukoon_dir_tab') as 'directory' | 'my-bookings') || 'directory';
  });

  useEffect(() => {
    localStorage.setItem('sukoon_dir_tab', activeTab);
  }, [activeTab]);

  // Booking Flow State
  const [bookingTherapist, setBookingTherapist] = useState<Therapist | null>(null);
  const [sessionType, setSessionType] = useState<'video' | 'audio' | 'chat'>('video');
  const [bookingDate, setBookingDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [notes, setNotes] = useState('');
  
  // Checkout State
  const [viewState, setViewState] = useState<'list' | 'checkout'>('list');
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState(false);
  const [newBookingId, setNewBookingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allTherapists = await getTherapists();
      setTherapists(allTherapists);

      if (currentUser && !isClientDemoAccount(currentUser)) {
        const bookings = await getSessionBookings({ clientId: currentUser.id });
        setSessionBookings(bookings || []);
        
        // Load Plan Limits
        try {
            const lRes = await fetch('/api/db/select', {
               method: 'POST', headers:{'content-type':'application/json'},
               body: JSON.stringify({table: 'user_subscriptions', filters: [{column: 'user_id', value: currentUser.id, type: 'eq'}]})
            });
            const lData = await lRes.json();
            let pRes = await fetch('/api/db/select', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({table: 'subscription_plans', filters: [{column: 'name', value: 'Free', type: 'eq'}]}) });
            let pData = await pRes.json();
            let userPlan = pData.data?.[0];
            if (lData.data && lData.data.length > 0) {
                const sub = lData.data[0];
                if (new Date(sub.expiry_date) > new Date() && sub.status === 'Active') {
                     let pReal = await fetch('/api/db/select', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({table: 'subscription_plans', filters: [{column: 'id', value: sub.plan_id, type: 'eq'}]}) });
                     let pRealData = await pReal.json();
                     if (pRealData.data && pRealData.data.length > 0) userPlan = pRealData.data[0];
                }
            }
            setLimits(userPlan);
        } catch(e) {}
      }
    } catch (e) {
      console.error("Error loading directory data", e);
    } finally {
      setLoading(false);
    }
  };

  // RECOMMENDATION LOGIC: Recommends Top based on Plan
  const getRecommendedTherapists = () => {
    const isPremium = limits && limits.name !== 'Free';
    const limitCount = isPremium ? 3 : 1; // Free users get 1 match, Premium get 3

    if (!currentUser || therapists.length === 0) return therapists.slice(0, limitCount);

    return [...therapists]
      .map(t => {
        let score = 0;

        // Pro priority alignment
        if (t.isPro) score += 100;
        
        // Boost tier priority visibility
        if (t.boostLevel === 'professional') score += 60;
        if (t.boostLevel === 'basic') score += 30;

        // Priority matching mapping (better match for premium)
        if (isPremium) {
            score += t.rating * 10;
        }

        // Experience weight
        score += t.experience * 1.5;

        // Rating weight
        score += t.rating * 5;

        // Language matching weight
        if (currentUser.preferredLanguage && t.languages.includes(currentUser.preferredLanguage)) {
          score += 25;
        }

        // Specialties vs style weight
        if (currentUser.therapistStyle) {
          const style = currentUser.therapistStyle.toLowerCase();
          const spec = t.specialty.toLowerCase();
          const bio = t.bio.toLowerCase();
          if (spec.includes(style) || bio.includes(style)) {
            score += 30;
          }
        }

        return { therapist: t, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limitCount)
      .map(item => item.therapist);
  };

  // DIRECTORY SORTING LOGIC: Boosted therapists sorted higher in natural listing
  const getSortedTherapists = () => {
    const list = [...therapists];
    
    // Simple query filter
    const filtered = list.filter(t => {
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.specialty.toLowerCase().includes(q) ||
        t.bio.toLowerCase().includes(q)
      );
    });

    // Priority Sort
    return filtered.sort((a, b) => {
      const scoreA = (a.isPro ? 100 : 0) + (a.boostLevel === 'professional' ? 60 : 0) + (a.boostLevel === 'basic' ? 30 : 0);
      const scoreB = (b.isPro ? 100 : 0) + (b.boostLevel === 'professional' ? 60 : 0) + (b.boostLevel === 'basic' ? 30 : 0);
      return scoreB - scoreA;
    });
  };

  const handleOpenBooking = (therapist: Therapist) => {
    if (redirectClientDemoToSignup(currentUser)) return;
    setBookingTherapist(therapist);
    // Auto preset values
    setSessionType('video');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setBookingDate(tomorrow.toISOString().split('T')[0]);
    
    if (therapist.availableSlots && therapist.availableSlots.length > 0) {
      setTimeSlot(therapist.availableSlots[0].time);
    } else {
      setTimeSlot('10:00 AM');
    }
    setViewState('list');
  };

  const handleProceedToCheckout = () => {
    if (!bookingTherapist) return;
    setViewState('checkout');
    setPaymentScreenshot(null);
    setTransactionId('');
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingTherapist || !currentUser) return;
    if (!paymentScreenshot) {
      alert("Please upload a valid payment receipt screenshot to complete verification.");
      return;
    }

    setSubmittingPayment(true);
    try {
      // 1. Creat dynamic booking record
      const feeAmount = 2000; // Rs 2000 standard session charge
      const bookingData = {
        id: crypto.randomUUID(),
        client_id: currentUser.id,
        therapist_id: bookingTherapist.id,
        session_type: sessionType,
        date: bookingDate,
        time_slot: timeSlot,
        duration: 60,
        fee: feeAmount,
        status: 'Payment Under Review', // Code status for payment verification
        payment_screenshot: paymentScreenshot,
        transaction_id: transactionId || null,
        notes: notes || null
      };

      await createSessionBooking(bookingData);

      // 2. Notifications to Admin & Client
      const adminId = '00000000-0000-0000-0000-000000000000';
      
      // Notify Admin
      await createNotification(
        adminId,
        'New Booking Payment Pending Verification',
        `Client ${currentUser.name} uploaded PKR ${feeAmount} payment receipt proof for a ${sessionType} session with Dr. ${bookingTherapist.name}.`,
        'system'
      );

      await createNotification(
        bookingTherapist.id,
        'New session request',
        `${currentUser.name} requested a ${sessionType} session on ${bookingDate} at ${timeSlot}. Payment is under review.`,
        'meeting'
      );

      // Notify Client
      await createNotification(
        currentUser.id,
        'Booking Payment Under Review',
        `Your payment confirmation screenshot for Dr. ${bookingTherapist.name} session on ${bookingDate} is under system audit.`,
        'meeting'
      );

      // Simulated processing delay for smooth UX
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Reload bookings list
      const bookings = await getSessionBookings({ clientId: currentUser.id });
      if (bookings) {
        bookings.sort((a, b) => {
          if (a.id === bookingData.id) return -1;
          if (b.id === bookingData.id) return 1;
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA;
        });
      }
      setSessionBookings(bookings || []);
      
      // Reset state & show success
      setBookingTherapist(null);
      setNotes('');
      setPaymentScreenshot(null);
      setTransactionId('');
      setNewBookingId(bookingData.id);
      setViewState('list');
      setActiveTab('my-bookings');
      setBookingSuccessMsg(true);

      // Auto-clear highlight after 5s
      setTimeout(() => setNewBookingId(null), 5000);

    } catch (e) {
      console.error(e);
      alert("Failed to record booking. Please try again.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Draft': return 'bg-slate-100 text-slate-700';
      case 'Pending Payment': return 'bg-amber-100 text-amber-800';
      case 'Payment Under Review': return 'bg-blue-100 text-blue-800 animate-pulse';
      case 'Payment Approved': return 'bg-emerald-100 text-emerald-800';
      case 'Payment Rejected': return 'bg-rose-100 text-rose-800';
      case 'Therapist Assigned': return 'bg-purple-100 text-purple-800';
      case 'Session Confirmed': return 'bg-teal-100 text-teal-800 font-bold';
      case 'Session Completed': return 'bg-indigo-100 text-indigo-800';
      case 'Cancelled': return 'bg-slate-300 text-slate-800';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const selectedRecommended = getRecommendedTherapists();
  const sortedAndFiltered = getSortedTherapists();

  return (
    <div className="p-6 md:p-12 overflow-y-auto h-full bg-slate-50 dark:bg-navy-900">
      
      {/* Top Bar Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-sans font-bold text-slate-800 dark:text-white mb-2">Therapist Directory</h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl">
            Schedule direct clinical assessments with certified practitioners. Verification is handled instantly.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center bg-white dark:bg-navy-800 p-1.5 rounded-2xl border border-slate-100 dark:border-navy-700 shadow-sm shrink-0">
          <button 
            onClick={() => { setActiveTab('directory'); setViewState('list'); }}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'directory' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
            Find Therapist
          </button>
          <button 
            onClick={() => { setActiveTab('my-bookings'); setViewState('list'); }}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all relative ${activeTab === 'my-bookings' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
            My Bookings
            {sessionBookings.filter(b => b.status === 'Payment Under Review').length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
            )}
          </button>
        </div>
      </div>

      {bookingSuccessMsg && (
        <div className="mb-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 rounded-2xl p-4 flex justify-between items-center animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <span className="bg-emerald-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold">✓</span>
            <div>
              <p className="font-bold">Booking submitted successfully. Your payment is under review.</p>
              <p className="text-xs opacity-90">An admin is auditing the receipt. You will be notified when your slot is assigned/confirmed.</p>
            </div>
          </div>
          <button onClick={() => setBookingSuccessMsg(false)} className="text-emerald-800 dark:text-emerald-300 font-bold px-2 py-1">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-8 animate-pulse font-sans">
          {/* Filters skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-12 bg-slate-100 dark:bg-navy-800/60 rounded-2xl" />
            <div className="h-12 bg-slate-100 dark:bg-navy-800/60 rounded-2xl" />
            <div className="h-12 bg-slate-100 dark:bg-navy-800/60 rounded-2xl" />
          </div>
          {/* Cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-slate-100 dark:bg-navy-800/40 rounded-3xl border border-slate-200/60 dark:border-navy-700/50 p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-200 dark:bg-navy-700 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 dark:bg-navy-700 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-16 bg-slate-200/50 dark:bg-navy-900/40 rounded-2xl" />
                <div className="h-10 bg-slate-200 dark:bg-navy-700 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'directory' ? (
        <>
          {viewState === 'list' ? (
            <div className="space-y-12">
              
              {/* RECOMMENDED FOR YOU SECTION */}
              {searchQuery === '' && selectedRecommended.length > 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Recommended For You</h2>
                    <span className="text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 font-bold px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900 border-dashed">Matching Style</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {selectedRecommended.map(therapist => (
                      <div key={`rec-${therapist.id}`} className="bg-white dark:bg-navy-800 rounded-3xl border border-amber-200 dark:border-amber-800/40 shadow-sm relative overflow-hidden flex flex-col hover:shadow-md transition-all">
                        {/* Highlights pro or basic/professional boost tags */}
                        <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[10px] font-sans font-extrabold uppercase px-3 py-1 rounded-full shadow-sm flex items-center gap-1 z-10">
                          <Award className="w-3.5 h-3.5" />
                          Recommended
                        </div>

                        <div className="h-28 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-navy-700 dark:to-navy-800 flex items-center p-6 relative">
                          <div className="w-16 h-16 rounded-full bg-white dark:bg-navy-900 border-2 border-amber-400 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xl text-slate-400 shadow-sm">
                            {therapist.imageUrl ? <img src={therapist.imageUrl} className="w-full h-full object-cover" /> : therapist.name[0]}
                          </div>
                          <div className="ml-4">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-1 text-base">
                              {therapist.name}
                              {(therapist.isPro) && (
                                <span className="bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase">Pro</span>
                              )}
                            </h3>
                            <p className="text-xs text-amber-600 font-semibold">{therapist.specialty}</p>
                          </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-3 mb-4">{therapist.bio}</p>
                          
                          <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs border-t border-slate-100 dark:border-navy-700 pt-3">
                              <span className="text-slate-400">Experience</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200">{therapist.experience} Years</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400">Consultation Rating</span>
                              <span className="font-bold text-teal-600 flex items-center gap-1">★ {therapist.rating} ({therapist.reviewCount || 10})</span>
                            </div>
                            
                            <button 
                              onClick={() => handleOpenBooking(therapist)}
                              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-colors text-sm"
                            >
                              <Calendar className="w-4 h-4" />
                              Book Recommended
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SEARCH & FILTERS */}
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                  <input 
                    type="text" 
                    placeholder="Search name, specialty, clinical qualifications..."
                    className="w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-navy-700 rounded-2xl bg-white dark:bg-navy-800 outline-none focus:border-teal-500 dark:focus:border-teal-600 text-sm shadow-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  <span className="absolute left-4 top-3.5 text-slate-400">🔍</span>
                </div>
              </div>

              {/* REGULAR DIRECTORY */}
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Directory Results ({sortedAndFiltered.length})</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {sortedAndFiltered.map(therapist => {
                    const isBoosted = therapist.boostLevel === 'professional' || therapist.boostLevel === 'basic';
                    const isProfessional = therapist.boostLevel === 'professional';

                    return (
                      <div 
                        key={therapist.id} 
                        className={`bg-white dark:bg-navy-800 rounded-3xl border shadow-sm overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all relative ${
                          isProfessional ? 'border-teal-500/80 dark:border-teal-500/30 ring-2 ring-teal-500/10' : 'border-slate-100 dark:border-navy-700'
                        }`}
                      >
                        {/* Badges/Tags matching Pro and Boost package priorities */}
                        <div className="absolute top-3 right-3 flex gap-2 z-10">
                          {therapist.isPro && (
                            <span className="bg-teal-600 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              PRO
                            </span>
                          )}
                          {isBoosted && (
                            <span className="bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              FEATURED
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="h-28 bg-gradient-to-r from-teal-50 to-lavender-50 dark:from-navy-700 dark:to-navy-800 relative flex items-end p-5">
                            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-navy-900 p-1 border-4 border-white dark:border-navy-800 shadow-md overflow-hidden flex items-center justify-center font-bold text-3xl text-slate-400 relative">
                              {therapist.imageUrl ? <img src={therapist.imageUrl} className="w-full h-full object-cover rounded-xl" /> : therapist.name[0]}
                            </div>
                            <div className="ml-4 mb-2 p-0.5">
                              <h3 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                                {therapist.name}
                              </h3>
                              <p className="text-xs text-teal-600 dark:text-teal-400 font-bold">{therapist.specialty}</p>
                            </div>
                          </div>

                          <div className="p-6 pt-5 space-y-4">
                            <div className="flex items-center gap-2 text-slate-400 text-xs">
                              <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                              <span className="truncate">{therapist.location || 'Lahore, Pakistan • Online Session'}</span>
                            </div>

                            <p className="text-slate-650 dark:text-slate-300 text-sm line-clamp-3 leading-snug">
                              {therapist.bio}
                            </p>

                            <div className="flex flex-wrap gap-2 pt-2">
                              {therapist.languages.map(lang => (
                                <span key={lang} className="px-2 py-1 bg-slate-100 dark:bg-navy-900 border border-slate-200/50 dark:border-navy-800 text-slate-600 dark:text-slate-300 text-xs rounded-lg">
                                  {lang}
                                </span>
                              ))}
                              <span className="px-2 py-1 bg-teal-50 dark:bg-navy-950 text-teal-700 dark:text-teal-400 text-xs font-bold rounded-lg">
                                {therapist.experience} Years Experience
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 pt-0 border-t border-slate-100 dark:border-navy-700 mt-6 pt-5">
                          {therapist.availableSlots && therapist.availableSlots.length > 0 && (
                            <div className="mb-4">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Available slots
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {therapist.availableSlots.slice(0, 3).map((slot, sIdx) => (
                                  <span key={sIdx} className="px-2 py-1 border border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-300 text-[10px] rounded-md font-medium">
                                    {slot.day} {slot.time}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <button 
                            onClick={() => handleOpenBooking(therapist)}
                            className="w-full text-center py-3 bg-slate-800 dark:bg-white dark:text-slate-900 text-white rounded-xl font-bold text-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-md"
                          >
                            <Calendar className="w-4 h-4" />
                            Book Consultation Session
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            /* CHECKOUT VIEW */
            <div className="max-w-xl mx-auto bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-3xl p-8 shadow-xl animate-scale-in">
              <button 
                onClick={() => setViewState('list')}
                className="mb-6 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold uppercase tracking-wider"
              >
                ← Back to List
              </button>

              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Booking Details Checkout</h2>
              
              <form onSubmit={handleSubmitPayment} className="space-y-6">
                
                {/* Invoice Summary Card */}
                <div className="bg-slate-50 dark:bg-navy-950 rounded-2xl p-5 border border-slate-150 dark:border-navy-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Session Invoice Summary</h3>
                  
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Therapist</span>
                      <span className="font-bold text-slate-800 dark:text-lavender-100">Dr. {bookingTherapist?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Session Type</span>
                      <span className="font-bold text-slate-800 dark:text-lavender-100 flex items-center gap-1 uppercase">
                        {sessionType === 'video' && <Video className="w-3.5 h-3.5 text-teal-600" />}
                        {sessionType === 'audio' && <Mic className="w-3.5 h-3.5 text-teal-600" />}
                        {sessionType === 'chat' && <MessageSquare className="w-3.5 h-3.5 text-teal-600" />}
                        {sessionType}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Appointment Date</span>
                      <span className="font-bold text-slate-800 dark:text-lavender-100">{bookingDate}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Requested Time Slot</span>
                      <span className="font-bold text-slate-800 dark:text-lavender-100">{timeSlot}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal Duration</span>
                      <span className="font-bold text-slate-800 dark:text-lavender-100">60 Mins (Clinical Hour)</span>
                    </div>
                    
                    <div className="border-t border-slate-200 dark:border-navy-800 pt-3 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total Payable Fee</span>
                      <span className="text-xl font-extrabold text-teal-600">PKR 2,000</span>
                    </div>
                  </div>
                </div>

                {/* Secure Payment details placeholder */}
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    <h4 className="font-bold text-amber-900 dark:text-amber-400 text-sm">Payment Deposit Instructions</h4>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-350 leading-relaxed">
                    Sukoon transactions are routed via secured bank channels. Please deposit your session fee of <strong>PKR 2,000</strong> to the wallet coordinate below:
                  </p>
                  
                  <div className="bg-white dark:bg-navy-950 rounded-xl p-4 border border-amber-200/50 dark:border-amber-900 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bank / digital Wallet</span>
                      <span className="font-extrabold text-slate-800 dark:text-white uppercase tracking-wide text-[11px]">NayaPay</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Account Recipient Title</span>
                      <span className="font-bold text-slate-850 dark:text-white">Syed Moiz</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-slate-500">Account Number</span>
                      <span className="font-bold text-slate-900 dark:text-teal-400 text-sm select-all">0312-8912998</span>
                    </div>
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Upload Payment Screenshot / Transfer Receipt</label>
                    <div className="border-2 border-dashed border-slate-200 dark:border-navy-700 hover:border-teal-500 dark:hover:border-teal-600 rounded-2xl p-6 text-center cursor-pointer relative transition-colors bg-slate-50 dark:bg-navy-950">
                      <input 
                        type="file" 
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={handleScreenshotChange}
                        required
                      />
                      {paymentScreenshot ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={paymentScreenshot} className="max-h-28 object-contain rounded-lg border border-slate-200" alt="Receipt preview" />
                          <span className="text-xs font-bold text-teal-600">Double click or drag to replace screenshot</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <Upload className="w-7 h-7 text-slate-400 mb-1" />
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-350">Drag & Drop or Click to Upload receipt image</p>
                          <p className="text-[10px] text-slate-400">PNG, JPG or JPEG allowed</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Screenshot ID / Transaction Reference (Optional)</label>
                    <input 
                      type="text"
                      className="w-full p-3 border border-slate-200 dark:border-navy-705 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none focus:border-teal-500 text-xs font-mono text-slate-700 dark:text-white"
                      placeholder="e.g. TRX1992812903"
                      value={transactionId}
                      onChange={e => setTransactionId(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Session Notes / Intake description (Optional)</label>
                    <textarea 
                      rows={2}
                      className="w-full p-3 border border-slate-200 dark:border-navy-705 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none focus:border-teal-500 text-xs text-slate-700 dark:text-white"
                      placeholder="Share symptoms or session expectations privately with Dr..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Actions */}
                <button 
                  type="submit"
                  disabled={submittingPayment}
                  className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-base flex justify-center items-center gap-2 shadow-lg hover:shadow-teal-600/10 transition-all disabled:opacity-50"
                >
                  {submittingPayment ? (
                    'Completing Secure Transaction...'
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Submit Payment, Register Session Booking
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </>
      ) : (
        /* MY BOOKINGS TAB */
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Your Booked consultations</h2>

          {sessionBookings.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-navy-800 rounded-3xl border border-slate-100 dark:border-navy-700">
              <p className="text-slate-400 dark:text-slate-500">You have not scheduled any clinical sessions yet.</p>
              <button 
                onClick={() => setActiveTab('directory')}
                className="mt-4 px-5 py-2.5 bg-teal-600 text-white font-bold text-xs rounded-xl"
              >
                Go to Registry Directory
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sessionBookings.map(booking => {
                const doc = therapists.find(t => t.id === booking.therapistId);
                return (
                  <div key={booking.id} className={`bg-white dark:bg-navy-800 rounded-3xl p-6 border shadow-sm flex flex-col justify-between transition-all duration-700 ${newBookingId === booking.id ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-teal-500/10' : 'border-slate-100 dark:border-navy-700'}`}>
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                            {doc?.imageUrl ? <img src={doc.imageUrl} className="w-full h-full object-cover" /> : doc?.name[0] || 'D'}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-base">Dr. {doc?.name || 'Practitioner'}</h3>
                            <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold">{doc?.specialty || 'Adult therapy'}</p>
                          </div>
                        </div>

                        {/* Status design matching specified list */}
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg shadow-sm border ${getStatusBadge(booking.status)}`}>
                          {booking.status}
                        </span>
                      </div>

                      <div className="space-y-2 border-t border-b border-slate-50 dark:border-navy-705 py-3.5 my-3.5 text-xs text-slate-600 dark:text-slate-350">
                        <div className="flex justify-between">
                          <span>Appt. Date & Time:</span>
                          <span className="font-bold text-slate-800 dark:text-white">{booking.date} • {booking.timeSlot}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Session Type:</span>
                          <span className="font-bold uppercase inline-flex items-center gap-1">
                            {booking.sessionType === 'video' && <Video className="w-3 h-3 text-slate-400" />}
                            {booking.sessionType === 'audio' && <Mic className="w-3 h-3 text-slate-400" />}
                            {booking.sessionType === 'chat' && <MessageSquare className="w-3 h-3 text-slate-400" />}
                            {booking.sessionType}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Therapeutic Fee Paid:</span>
                          <span className="font-bold text-slate-800 dark:text-white">PKR {booking.fee?.toLocaleString() || '2,000'}</span>
                        </div>
                        {booking.transactionId && (
                          <div className="flex justify-between font-mono text-[10px] text-slate-400">
                            <span>TRX ID Ref:</span>
                            <span>{booking.transactionId}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      {booking.status === 'Payment Approved' || booking.status === 'Session Confirmed' || booking.status === 'Therapist Assigned' ? (
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 rounded-xl p-3 flex justify-between items-center text-xs text-emerald-800 dark:text-emerald-400">
                          <div>
                            <span className="font-bold">Session Confirmed!</span>
                            <span className="block text-[10px] opacity-90 mt-0.5">Please check meeting link or join from calendar chat.</span>
                          </div>
                          {doc?.bookingUrl ? (
                            <a 
                              href={doc.bookingUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition"
                            >
                              Join Session
                            </a>
                          ) : (
                            <span className="text-[10px] italic">Meeting pending</span>
                          )}
                        </div>
                      ) : booking.status === 'Payment Rejected' ? (
                        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-150 rounded-xl p-3 text-xs text-rose-800 dark:text-rose-400">
                          <p className="font-bold">Payment Rejected</p>
                          <p className="text-[10px] mt-0.5 leading-snug">The admin couldn't verify this screenshot coordinate deposit. Please recheck coordinate and proceed to re-upload.</p>
                          <button 
                            onClick={() => { setBookingTherapist(doc || null); setViewState('checkout'); setActiveTab('directory'); }}
                            className="mt-2.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px]"
                          >
                            Resubmit Receipt Screenshot
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 italic text-center">
                          Waiting for receipt auditing... An admin is reviewing transaction proof.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QUICK INLINE BOOKING CONFIG DRAWER */}
      {bookingTherapist && viewState === 'list' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-800 rounded-3xl w-full max-w-md p-8 border border-slate-100 dark:border-navy-700 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => setBookingTherapist(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 text-2xl font-bold"
            >
              ×
            </button>

            <h3 className="text-xl font-bold text-slate-800 dark:text-white text-center mb-6">Book Clinical Session</h3>
            
            <div className="bg-slate-50 dark:bg-navy-950 border border-slate-100 rounded-2xl p-4 flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-slate-200">
                {bookingTherapist.imageUrl ? <img src={bookingTherapist.imageUrl} className="w-full h-full object-cover" /> : bookingTherapist.name[0]}
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white">Dr. {bookingTherapist.name}</h4>
                <p className="text-xs text-teal-600 font-semibold">{bookingTherapist.specialty}</p>
              </div>
            </div>

            <div className="space-y-4">
              
              {/* Session Type */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Consultation Session Medium</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'video', label: 'Video', icon: <Video className="w-3.5 h-3.5 shrink-0" /> },
                    { type: 'audio', label: 'Audio', icon: <Mic className="w-3.5 h-3.5 shrink-0" /> },
                    { type: 'chat', label: 'Chat', icon: <MessageSquare className="w-3.5 h-3.5 shrink-0" /> }
                  ].map(medium => (
                    <button
                      key={medium.type}
                      type="button"
                      onClick={() => setSessionType(medium.type as any)}
                      className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all ${
                        sessionType === medium.type 
                          ? 'border-teal-500 bg-teal-500 text-white shadow-sm' 
                          : 'border-slate-200 dark:border-navy-700 text-slate-600 hover:bg-slate-50 dark:text-slate-350'
                      }`}
                    >
                      {medium.icon}
                      {medium.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Select Appointment Date</label>
                <input 
                  type="date"
                  className="w-full p-3 border border-slate-200 dark:border-navy-705 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none focus:border-teal-500 text-xs font-medium"
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              {/* Time Slot Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Pick Time Slot</label>
                <select
                  className="w-full p-3 border border-slate-200 dark:border-navy-705 bg-slate-50 dark:bg-navy-950 rounded-xl outline-none focus:border-teal-500 text-xs font-semibold"
                  value={timeSlot}
                  onChange={e => setTimeSlot(e.target.value)}
                  required
                >
                  {bookingTherapist.availableSlots && bookingTherapist.availableSlots.length > 0 ? (
                    bookingTherapist.availableSlots.map((slot, idx) => (
                      <option key={idx} value={slot.time}>{slot.day} {slot.time}</option>
                    ))
                  ) : (
                    <>
                      <option value="09:00 AM">09:00 AM</option>
                      <option value="11:00 AM">11:00 AM</option>
                      <option value="02:00 PM">02:00 PM</option>
                      <option value="04:00 PM">04:00 PM</option>
                    </>
                  )}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setBookingTherapist(null)}
                  className="flex-1 py-3 text-slate-500 font-bold text-xs hover:bg-slate-50 dark:hover:bg-navy-900 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleProceedToCheckout}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5"
                >
                  Checkout and Pay
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
