import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, GraduationCap, BarChart } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Hero section with solid navy background to ensure readability */}
      <section className="w-full bg-[#0a2540] text-white">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className="flex flex-col items-center text-center gap-3">
            {/* Brand logo (large) */}
            <img
              src="/wagerproof-landing.png"
              alt="WAGER PROOF"
              className="h-56 sm:h-72 w-auto drop-shadow-xl -mb-4 sm:-mb-6"
            />
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">WagerProof</h1>
            <p className="max-w-2xl text-white/90 text-base sm:text-lg">
              Navigate to live predictions and tools across the site. Pick a sport to get started.
            </p>
            <div className="flex gap-4 flex-wrap justify-center">
              {/* Unified button style for consistency */}
              <div className="rounded-full p-[2px] bg-gradient-to-r from-emerald-400 to-blue-500 shadow-[0_0_18px_rgba(16,185,129,0.35)]">
                <Link to="/nfl">
                  <Button size="lg" className="rounded-full px-7 py-3 text-lg bg-white text-[#0a2540] hover:bg-white">
                    NFL
                  </Button>
                </Link>
              </div>
              <div className="rounded-full p-[2px] bg-gradient-to-r from-emerald-400 to-blue-500 shadow-[0_0_18px_rgba(16,185,129,0.35)]">
                <Link to="/college-football">
                  <Button size="lg" className="rounded-full px-7 py-3 text-lg bg-white text-[#0a2540] hover:bg-white">
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
                  <Button size="lg" disabled className="rounded-full px-7 py-3 text-lg bg-white text-[#0a2540]">
                    NBA
                  </Button>
                </div>
                <div className="rounded-full p-[2px] bg-gradient-to-r from-slate-300 to-slate-500 opacity-70">
                  <Button size="lg" disabled className="rounded-full px-7 py-3 text-lg bg-white text-[#0a2540]">
                    NCAAB
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

        {/* Removed repetitive quick nav cards below the hero */}
    </div>
  );
}


