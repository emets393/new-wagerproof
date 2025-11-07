import Paywall from "@/components/Paywall";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Zap, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Dither from "@/components/Dither";

export default function AccessDenied() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative bg-black/30 backdrop-blur-sm p-6 overflow-hidden rounded-3xl">
      {/* Dither Background Effect */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl" style={{ clipPath: 'inset(0 round 1.5rem)' }}>
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

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-xl shadow-lg">
              <Lock className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white drop-shadow-lg">Unlock Premium Features</h1>
              <p className="text-white/80 mt-1">Subscribe to access all powerful analytics and tools</p>
            </div>
          </div>

          {/* Paywall Card or Sign In Prompt */}
          <Card
            className="border-white/20"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
            }}
          >
            <CardHeader className="border-b border-white/10">
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-400" />
                Choose Your Plan
              </CardTitle>
              {user ? (
                <CardDescription className="text-white/70">
                  You're logged in as <span className="font-semibold text-white">{user.email}</span>
                </CardDescription>
              ) : (
                <CardDescription className="text-white/70">
                  Sign in to view subscription plans and complete checkout
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="pt-6">
              {authLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
                </div>
              ) : !user ? (
                <div className="text-center space-y-6 py-8">
                  <div className="flex justify-center">
                    <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-full">
                      <LogIn className="w-8 h-8 text-green-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-white">Sign In Required</h3>
                    <p className="text-white/70 max-w-md mx-auto">
                      Please sign in to view subscription plans and complete your purchase. 
                      You'll need an account to manage your subscription.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => navigate('/account')}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In to Continue
                  </Button>
                </div>
              ) : (
                <Paywall showButton={true} />
              )}
            </CardContent>
          </Card>

          {/* Feature Preview Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center">What You'll Get</h2>

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
          </div>
        </div>
      </div>
    </div>
  );
}
