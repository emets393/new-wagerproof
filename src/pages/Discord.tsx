import { DiscordLogo } from "phosphor-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, MessageCircle, Shield, Bell } from "lucide-react";
import Dither from "@/components/Dither";

export default function Discord() {
  const discordInviteUrl = "https://discord.gg/Mc4ZcRpx9g";

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
      
      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-[#5865F2] to-[#7289DA] shadow-2xl">
            <DiscordLogo className="w-12 h-12 text-white" weight="fill" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Join Our Discord Community
          </h1>
          
        </div>

        <Card 
          className="mb-8 border-white/20 shadow-2xl"
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
          }}
        >
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-6">
              <div className="inline-block p-4 bg-white/10 rounded-full mb-4">
                <Shield className="w-12 h-12 text-green-400" />
              </div>
              
              <h2 className="text-2xl font-bold text-white">
                As a member of the WagerProof community, you have access to our private Discord server!
              </h2>
              
              <p className="text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
                Click below to join other community members! Enable notifications to receive instant alerts for Editors Picks on your phone, and share betting insights, strategies, and analysis with the community.
              </p>

              <div className="pt-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-r from-[#5865F2] to-[#7289DA] hover:from-[#4752C4] hover:to-[#5B6EBC] text-white shadow-lg hover:shadow-xl transition-all duration-300 text-lg px-8 py-6 h-auto"
                >
                  <a 
                    href={discordInviteUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3"
                  >
                    <DiscordLogo className="w-6 h-6" weight="fill" />
                    <span>Join Exclusive Discord Community</span>
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card 
            className="border-white/20 hover:scale-105 transition-all duration-200"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
            }}
          >
            <CardContent className="pt-6 pb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-white/10">
                <Users className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">
                Active Community
              </h3>
              <p className="text-sm text-white/70">
                Connect with subscribers who share your passion for smart betting
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-white/20 hover:scale-105 transition-all duration-200"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
            }}
          >
            <CardContent className="pt-6 pb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-white/10">
                <Bell className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">
                Push Notifications
              </h3>
              <p className="text-sm text-white/70">
                Get instant Editors Picks alerts sent directly to your phone
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-white/20 hover:scale-105 transition-all duration-200"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.5)'
            }}
          >
            <CardContent className="pt-6 pb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-white/10">
                <Shield className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">
                Exclusive Access
              </h3>
              <p className="text-sm text-white/70">
                Subscriber-only channels with premium content and analysis
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-white/60">
          <p>
            By joining our Discord server, you agree to follow our community guidelines and Discord's Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}

