import { useState, useEffect } from "react";
import Paywall from "@/components/Paywall";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, ArrowRight, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Dither from "@/components/Dither";

export default function AccessDenied() {
  const { user } = useAuth();
  const [showPaywall, setShowPaywall] = useState(false);

  // Auto-show paywall section
  useEffect(() => {
    const timer = setTimeout(() => setShowPaywall(true), 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen relative bg-black/30 backdrop-blur-sm p-6 overflow-hidden">
      {/* Dither Background Effect */}
      <div className="absolute inset-0 overflow-hidden">
        <Dither
          waveSpeed={0.05}
          waveFrequency={3}
          waveAmplitude={0.3}
          waveColor={[0.13, 0.77, 0.37]}
          colorNum={4}
          pixelSize={2}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0}
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Overlay with paywall */}
        {showPaywall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="max-w-2xl w-full">
              <Card 
                className="border-white/30 hover:border-white/50 transition-all duration-300"
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  backdropFilter: 'blur(40px)',
                  WebkitBackdropFilter: 'blur(40px)',
                  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)',
                }}
              >
                <CardHeader className="text-center space-y-2 border-b border-white/10">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-full backdrop-blur-sm">
                      <Lock className="w-6 h-6 text-green-400" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl text-white drop-shadow-lg">Unlock Premium Features</CardTitle>
                  <CardDescription className="text-white/70">
                    Subscribe to access all powerful analytics and tools
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {/* Paywall Component */}
                  <div 
                    className="rounded-lg p-6 border border-white/10"
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                    }}
                  >
                    <Paywall showButton={true} />
                  </div>

                  {/* Info Text */}
                  <div className="text-center space-y-2 text-sm text-white/70">
                    <p>You're logged in as <span className="font-semibold text-white">{user?.email}</span></p>
                    <p>Subscribe now to start using all features and get advanced insights for your betting strategy.</p>
                  </div>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="px-2 text-white/50" style={{ background: 'rgba(0, 0, 0, 0.4)' }}>or</span>
                    </div>
                  </div>

                  {/* Continue Browsing */}
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPaywall(false)}
                    className="w-full border-white/20 text-white hover:bg-white/10"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Continue Browsing Free Features
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Free Content Behind Overlay */}
        <div className="max-w-6xl mx-auto w-full py-8">
          <div className="space-y-8">
            {/* Welcome Message */}
            <div className="text-center space-y-4">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-xl shadow-lg">
                  <Zap className="w-8 h-8 text-green-400" />
                </div>
              </div>
              <h1 className="text-4xl font-bold text-white drop-shadow-lg">Welcome to WagerProof</h1>
              <p className="text-lg text-white/80 max-w-2xl mx-auto">
                You have access to browse our free features. Upgrade to unlock advanced analytics, real-time predictions, and premium insights.
              </p>
            </div>

            {/* Feature Preview Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  title: "Historical Analytics",
                  description: "View past performance patterns and trends",
                  icon: "📊",
                },
                {
                  title: "Live Score Updates",
                  description: "Real-time game information and statistics",
                  icon: "🔴",
                },
                {
                  title: "Pattern Recognition",
                  description: "AI-powered prediction analysis",
                  icon: "🤖",
                },
                {
                  title: "Teaser Tool",
                  description: "Optimize your teaser combinations",
                  icon: "🎯",
                },
                {
                  title: "Expert Picks",
                  description: "Premium analyst recommendations",
                  icon: "⭐",
                },
                {
                  title: "Bet Slip Grader",
                  description: "Analyze your bet performance",
                  icon: "📈",
                },
              ].map((feature, index) => (
                <Card 
                  key={index} 
                  className="border-white/20 hover:border-white/40 hover:scale-105 transition-all duration-200"
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.3)'
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="text-4xl mb-3">{feature.icon}</div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-white/70 mt-1">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Call to Action */}
            <div className="text-center space-y-4 pt-4">
              <p className="text-white/80">Ready to get started?</p>
              <Button 
                size="lg"
                onClick={() => setShowPaywall(true)}
                className="mx-auto bg-green-600 hover:bg-green-700 text-white"
              >
                <Lock className="w-4 h-4 mr-2" />
                View Subscription Options
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
