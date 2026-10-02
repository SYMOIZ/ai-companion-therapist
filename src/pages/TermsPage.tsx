
import React from 'react';

const Section = ({ title, children }: { title: string, children?: React.ReactNode }) => (
  <section>
    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-3">{title}</h2>
    <div className="text-slate-600 dark:text-slate-300 leading-relaxed">
      {children}
    </div>
  </section>
);

export const TermsPage: React.FC = () => {
  return (
    <div className="p-6 md:p-12 overflow-y-auto h-full max-w-4xl mx-auto font-sans text-slate-700 dark:text-slate-300">
      <h1 className="text-4xl font-bold text-slate-800 dark:text-white mb-8">Terms of Service & Privacy Policy</h1>
      <div className="bg-white dark:bg-navy-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-navy-700 space-y-10">
        
        {/* Intro */}
        <p className="italic opacity-80 border-l-4 border-lavender-400 pl-4">
          By accessing or using Sukoon AI, you acknowledge and agree to these terms. Failure to comply may result in immediate account disqualification.
        </p>

        <Section title="1. The 'Iron Dome' Privacy Protocol (Strict Non-Circumvention)">
          <p className="font-semibold mb-2">At Sukoon, we prioritize the safety and anonymity of both our clients and therapists. To maintain this secure environment, the following 'Iron Dome' rules apply strictly to all users:</p>
          
          <div className="space-y-4">
              <div className="bg-rose-50 dark:bg-rose-900/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900">
                  <h3 className="font-bold text-rose-700 dark:text-rose-400 mb-1">Zero-Tolerance for Off-Platform Contact</h3>
                  <p className="text-sm">Users agree that all communication, scheduling, and monetary transactions must occur exclusively within the Sukoon platform. Sharing personal contact information—including but not limited to WhatsApp numbers, personal email addresses, Instagram/Facebook handles, or private Zoom/Skype links—is strictly prohibited.</p>
              </div>

              <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl">
                  <h3 className="font-bold text-slate-800 dark:text-white mb-1">The 'One-Strike' Penalty</h3>
                  <p className="text-sm">Our automated security systems scan all messages for patterns resembling phone numbers or external IDs. Any attempt to lure a user off-platform will result in an <span className="font-bold">Immediate & Permanent Ban</span>. No warnings will be issued. Any pending earnings or session credits will be forfeited immediately upon violation.</p>
              </div>

              <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-xl">
                  <h3 className="font-bold text-slate-800 dark:text-white mb-1">Safety Liability</h3>
                  <p className="text-sm">Sukoon cannot verify the identity or safety of individuals outside our secure ecosystem. If you choose to contact a user externally, you do so at your own risk, and Sukoon waives all liability for fraud, harassment, or misconduct that occurs off-platform.</p>
              </div>
          </div>
        </Section>

        <Section title="2. Financial Policy (The 20% Rule & Payouts)">
          <div className="space-y-4">
              <div>
                  <h3 className="font-bold text-slate-800 dark:text-white mb-2">2.1 Commission Structure</h3>
                  <ul className="list-disc ml-5 space-y-1 text-sm">
                      <li><strong>Platform Fee:</strong> Sukoon retains a flat 20% commission on every completed session fee.</li>
                      <li><strong>Therapist Earnings:</strong> You retain 80% of the total session price.</li>
                      <li>Example: If you charge PKR 2,000 for a session, you earn PKR 1,600, and Sukoon retains PKR 400.</li>
                  </ul>
              </div>
              
              <div>
                  <h3 className="font-bold text-slate-800 dark:text-white mb-2">2.2 The 29-Day Payout Cycle</h3>
                  <p className="text-sm mb-2">We operate on a 29-Day Rolling Payout Cycle. This means earnings from a session are "Cleared" for withdrawal exactly 29 days after the session is completed.</p>
                  <p className="text-sm"><strong>Why?</strong> This holding period allows us to ensure the session was conducted satisfactorily, process any disputes, and verify no fraudulent activity occurred.</p>
              </div>
          </div>
        </Section>

        <Section title="3. Data Integrity & Client Confidentiality">
          <ul className="list-disc ml-5 space-y-2">
            <li><strong>Therapist Obligation:</strong> Therapists are legally and ethically bound to protect patient identity. Recording sessions (audio or video) or taking screenshots of text chats is a direct violation of our code of ethics.</li>
            <li><strong>Client Protection:</strong> Clients (Students) must also respect the privacy of their therapists. Sharing a therapist’s profile, private advice, or session content on social media without explicit written consent is grounds for immediate account termination.</li>
          </ul>
        </Section>

        <Section title="4. Admin 'Disqualification' System">
          <p className="mb-2">If a user (Therapist or Student) violates the terms, they are not just "blocked"; they are shown a Disqualification Statement.</p>
          <div className="p-4 border-l-4 border-rose-500 bg-slate-50 dark:bg-navy-950 text-sm">
              <p><strong>Formal Notice of Disqualification:</strong> "Your access to the Sukoon Platform has been revoked indefinitely. Our security systems flagged your account for a Critical Policy Violation. Your profile is now hidden. Your chat history is locked for audit. Any remaining wallet balance has been frozen pending investigation."</p>
          </div>
        </Section>

        <Section title="5. Prototype Disclaimer">
          <p className="text-sm">Sukoon AI is a technology demonstration. While we strive for privacy and security, please note that this is a prototype environment. User login sessions may time out, and data stored in the browser (LocalStorage) will be lost if the cache is cleared. Please strictly follow the 'Iron Dome' rules even in this test environment.</p>
        </Section>

      </div>
    </div>
  );
};
