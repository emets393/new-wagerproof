import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, GraduationCap, BarChart, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GradientText } from '@/components/ui/gradient-text';

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a2540]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          <p className="text-white/90">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Hero section with solid navy background to ensure readability */}
      <section className="w-full bg-[#0a2540] text-white">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className="flex flex-col items-center text-center gap-3">
            {/* Brand logo (large) */}
            <img
              src="/wagerproofGreenLight.png"
              alt="WAGER PROOF"
              className="h-56 sm:h-72 w-auto object-contain rounded-lg drop-shadow-xl -mb-4 sm:-mb-6 dark:hidden"
            />
            <img
              src="/wagerproofGreenDark.png"
              alt="WAGER PROOF"
              className="h-56 sm:h-72 w-auto object-contain rounded-lg drop-shadow-xl -mb-4 sm:-mb-6 hidden dark:block"
            />
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              <span className="text-white">Wager</span>
              <GradientText 
                text="Proof" 
                gradient="linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%)"
                className="inline"
              />
            </h1>
            <p className="max-w-2xl text-white/90 text-base sm:text-lg">
              {user ? 'Navigate to live predictions and tools across the site. Pick a sport to get started.' : 'Get started with data-driven sports betting insights. Sign in to access predictions and analytics.'}
            </p>
            
            {user ? (
              // Sport selection buttons for authenticated users
              <>
                <div className="flex gap-4 flex-wrap justify-center">
                  {/* Unified button style for consistency */}
                  <div className="rounded-full p-[2px] bg-gradient-to-r from-emerald-400 to-blue-500 shadow-[0_0_18px_rgba(16,185,129,0.35)]">
                    <Link to="/nfl">
                      <Button size="lg" className="rounded-full px-7 py-3 text-lg w-56 bg-white text-[#0a2540] hover:bg-white">
                        NFL
                      </Button>
                    </Link>
                  </div>
                  <div className="rounded-full p-[2px] bg-gradient-to-r from-emerald-400 to-blue-500 shadow-[0_0_18px_rgba(16,185,129,0.35)]">
                    <Link to="/college-football">
                      <Button size="lg" className="rounded-full px-7 py-3 text-lg w-56 bg-white text-[#0a2540] hover:bg-white">
                        College Football
                      </Button>
                    </Link>
                  </div>
                </div>


                {/* Coming soon section */}
                <div className="mt-8 sm:mt-10 text-center">
                  <div className="text-sm uppercase tracking-widest text-white/70 mb-4">Coming Soon</div>
                  <div className="flex gap-4 flex-wrap justify-center">
                    <div className="rounded-full p-[2px] bg-gradient-to-r from-slate-300 to-slate-500 opacity-70">
                      <Button size="lg" disabled className="rounded-full px-7 py-3 text-lg w-56 bg-white text-[#0a2540]">
                        NBA
                      </Button>
                    </div>
                    <div className="rounded-full p-[2px] bg-gradient-to-r from-slate-300 to-slate-500 opacity-70">
                      <Button size="lg" disabled className="rounded-full px-7 py-3 text-lg w-56 bg-white text-[#0a2540]">
                        NCAAB
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              // Professional sign in/sign up buttons for non-authenticated users
              <div className="flex gap-8 flex-wrap justify-center mt-8">
                <Button
                  asChild
                  size="lg"
                  className="px-12 py-4 text-xl bg-gradient-to-b from-white to-gray-100 text-[#0a2540] hover:from-gray-50 hover:to-gray-200 font-bold shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-200 border-2 border-gray-200"
                >
                  <Link to="/account">Sign In / Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Informational sections */}
      <section className="bg-white">
        <div className="container mx-auto px-4 py-12 sm:py-16 text-gray-800">
          {/* Headline + Subheadline */}
          <div className="max-w-4xl mx-auto text-center space-y-4 mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Smarter Sports Betting Starts Here.</h2>
            <p className="text-base sm:text-lg text-gray-600">
              WagerProof uses real data — not hype — to identify true betting edges across the NFL, NBA, MLB, and College Football.
              <br />
              No emotion. No “locks.” Just transparent, data-backed predictions built from machine learning models that track accuracy over time.
            </p>
          </div>

          {/* Section 1 */}
          <div className="max-w-5xl mx-auto grid gap-6 sm:grid-cols-5 items-start mb-12">
            <div className="sm:col-span-2">
              <h3 className="text-xl sm:text-2xl font-bold">Real Models. Real Results.</h3>
            </div>
            <div className="sm:col-span-3 text-gray-700 leading-relaxed">
              <p className="mb-3">
                Every pick you see on Wagerproof is generated from custom code and live data pipelines — not AI guesses or public trends.
              </p>
              <p>
                Our models pull stats, betting lines, weather, and matchup data in real time, then calculate where the numbers disagree with the sportsbooks.
              </p>
            </div>
          </div>

          {/* Section 2 - Key Features */}
          <div className="max-w-5xl mx-auto grid gap-6 sm:grid-cols-5 items-start mb-12">
            <div className="sm:col-span-2">
              <h3 className="text-xl sm:text-2xl font-bold">Key Features</h3>
            </div>
            <div className="sm:col-span-3 text-gray-700">
              <ul className="space-y-3">
                <li>📊 <span className="font-semibold">Daily Model Predictions</span> — Moneyline, Spread, and Over/Under probabilities for every game.</li>
                <li>📈 <span className="font-semibold">Advanced Trend Analysis</span> — Discover hidden statistical patterns and market inefficiencies using professional-grade analytical tools.</li>
                <li>🧠 <span className="font-semibold">Educational Tools</span> — Learn how data modeling really works and how to spot edges for yourself.</li>
              </ul>
            </div>
          </div>

          {/* Section 3 - Why Wagerproof */}
          <div className="max-w-5xl mx-auto grid gap-6 sm:grid-cols-5 items-start">
            <div className="sm:col-span-2">
              <h3 className="text-xl sm:text-2xl font-bold">Why Wagerproof</h3>
            </div>
            <div className="sm:col-span-3 text-gray-700 leading-relaxed">
              <p className="mb-3">
                Sports betting is full of noise — influencers, hype, and bad math. Wagerproof cuts through that with clean data, explainable models, and results you can verify.
              </p>
              <p>
                We don’t sell picks — we show you how the numbers actually play out.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* End Informational sections */}

    </div>
  );
}


