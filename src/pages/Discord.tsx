import { DiscordLogo } from "phosphor-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, MessageCircle, Shield, Bell, CheckCircle2, Link2, AlertTriangle } from "lucide-react";
import Dither from "@/components/Dither";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const DISCORD_LINK_URL = "https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/discord-callback";

export default function Discord() {
  const discordInviteUrl = "https://discord.gg/gwy9y7XSDV";
  const { user } = useAuth();
  const [discordLinked, setDiscordLinked] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const linkStatus = searchParams.get("link");
  const linkUsername = searchParams.get("username");
  const linkReason = searchParams.get("reason");

  useEffect(() => {
    async function checkDiscordLink() {
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("discord_user_id")
        .eq("user_id", user.id)
        .single();
      const linked = !!data?.discord_user_id;
      setDiscordLinked(linked);
      // If we just got redirected back with success, also mark as linked
      if (linkStatus === "success" || linkStatus === "partial") {
        setDiscordLinked(true);
      }
      setLoading(false);
    }
    checkDiscordLink();
  }, [user, linkStatus]);

  // Clear the URL params after showing the message
  useEffect(() => {
    if (linkStatus) {
      const timer = setTimeout(() => {
        setSearchParams({});
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [linkStatus, setSearchParams]);

  const handleLinkDiscord = () => {
    if (!user) return;
    window.location.href = `${DISCORD_LINK_URL}?user_id=${user.id}`;
  };

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

      <div className="relative z-10 max-w-4xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-[#5865F2] to-[#7289DA] shadow-2xl">
            <DiscordLogo className="w-12 h-12 text-white" weight="fill" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Join Our Discord Community
          </h1>

        </div>

        {/* Link status banner */}
        {linkStatus === "success" && (
          <Card className="mb-6 border-green-500/30" style={{ background: 'rgba(34, 197, 94, 0.1)', backdropFilter: 'blur(40px)' }}>
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-4 justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-400 shrink-0" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">Discord Linked Successfully!</p>
                  <p className="text-white/70">Welcome, {linkUsername}! You now have the WagerProof Member role. Join the server below to access subscriber-only channels.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {linkStatus === "partial" && (
          <Card className="mb-6 border-yellow-500/30" style={{ background: 'rgba(245, 158, 11, 0.1)', backdropFilter: 'blur(40px)' }}>
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-4 justify-center">
                <AlertTriangle className="w-8 h-8 text-yellow-400 shrink-0" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">Account Linked</p>
                  <p className="text-white/70">{linkUsername}, your Discord is linked but your role is still being assigned. It will appear within a few minutes. If not, contact support.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {linkStatus === "error" && (
          <Card className="mb-6 border-red-500/30" style={{ background: 'rgba(239, 68, 68, 0.1)', backdropFilter: 'blur(40px)' }}>
            <CardContent className="pt-6 pb-6">
              <div className="flex items-center gap-4 justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400 shrink-0" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-white">Something Went Wrong</p>
                  <p className="text-white/70">
                    {linkReason === "no_subscription" ? "You need an active subscription to link your Discord account." :
                     linkReason === "user_not_found" ? "User not found. Please make sure you're logged in." :
                     "Discord linking failed. Please try again."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Link Discord Account */}
        <Card
          className="mb-6 border-white/20 shadow-2xl"
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
                {discordLinked ? (
                  <CheckCircle2 className="w-12 h-12 text-green-400" />
                ) : (
                  <Link2 className="w-12 h-12 text-blue-400" />
                )}
              </div>

              <h2 className="text-2xl font-bold text-white">
                {discordLinked ? "Discord Account Linked!" : "Step 1: Link Your Discord Account"}
              </h2>

              <p className="text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
                {discordLinked
                  ? "Your Discord account is connected. You have the WagerProof Member role and full access to subscriber-only channels."
                  : "Link your Discord account to verify your subscription and get the WagerProof Member role with access to exclusive channels."
                }
              </p>

              {!loading && !discordLinked && (
                <div className="pt-4">
                  <Button
                    onClick={handleLinkDiscord}
                    size="lg"
                    className="bg-gradient-to-r from-[#5865F2] to-[#7289DA] hover:from-[#4752C4] hover:to-[#5B6EBC] text-white shadow-lg hover:shadow-xl transition-all duration-300 text-lg px-8 py-6 h-auto"
                  >
                    <div className="flex items-center gap-3">
                      <DiscordLogo className="w-6 h-6" weight="fill" />
                      <span>Link Discord Account</span>
                    </div>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Join the Server */}
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
                {discordLinked ? "You're all set! Join the server below." : "Step 2: Join the Discord Server"}
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
                    <span>Chat Now!</span>
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

