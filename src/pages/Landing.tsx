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
          <div className="flex flex-col items-center text-center gap-6">
            {/* Brand logo (large) */}
            <img
              src="/wagerproof-landing.png"
              alt="WAGER PROOF"
              className="h-28 sm:h-36 w-auto drop-shadow-xl"
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

        {/* Quick Nav Cards */}
        <div className="container mx-auto px-4 py-8 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <Trophy className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">NFL Predictions</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Live lines, weather, and model edges.</p>
              <Link to="/nfl"><Button>Go to NFL</Button></Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">College Football</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Team edges, totals, and game weather.</p>
              <Link to="/college-football"><Button>Go to CFB</Button></Link>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <BarChart className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Account & Settings</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Manage access and preferences.</p>
              <Link to="/account"><Button variant="outline">Account</Button></Link>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}


