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
            <div className="flex gap-3 flex-wrap justify-center">
              <Link to="/nfl"><Button size="lg" className="bg-white text-[#0a2540] hover:bg-white/90">NFL</Button></Link>
              <Link to="/college-football"><Button size="lg" variant="secondary" className="bg-transparent border-white text-white hover:bg-white/10">College Football</Button></Link>
            </div>
          </div>
        </div>
      </section>

        {/* Removed repetitive quick nav cards below the hero */}
    </div>
  );
}


