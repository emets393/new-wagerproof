import { DiscordLogo } from "phosphor-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, MessageCircle, Shield } from "lucide-react";

export default function Discord() {
  const discordInviteUrl = "https://discord.gg/Mc4ZcRpx9g";

  return (
    <div className="min-h-screen bg-gradient-to-br from-honeydew-50 via-white to-honeydew-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-full bg-gradient-to-br from-[#5865F2] to-[#7289DA] shadow-2xl">
            <DiscordLogo className="w-12 h-12 text-white" weight="fill" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Join Our Discord Community
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Connect with fellow WagerProof subscribers and get exclusive access to our community discussions and access to the development team.
          </p>
        </div>

        <Card className="mb-8 border-2 border-honeydew-200 dark:border-honeydew-800 shadow-xl">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-6">
              <div className="inline-block p-4 bg-honeydew-100 dark:bg-honeydew-900/30 rounded-full mb-4">
                <Shield className="w-12 h-12 text-honeydew-600 dark:text-honeydew-400" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                As a member of the WagerProof community, you have access to our private Discord server!
              </h2>
              
              <p className="text-lg text-gray-700 dark:text-gray-300 max-w-xl mx-auto leading-relaxed">
                Click below to join other community members! We're waiting to hear from you and share betting insights, strategies, and analysis.
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
          <Card className="border border-honeydew-200 dark:border-honeydew-800 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-honeydew-100 dark:bg-honeydew-900/30">
                <Users className="w-6 h-6 text-honeydew-600 dark:text-honeydew-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Active Community
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Connect with subscribers who share your passion for smart betting
              </p>
            </CardContent>
          </Card>

          <Card className="border border-honeydew-200 dark:border-honeydew-800 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-honeydew-100 dark:bg-honeydew-900/30">
                <MessageCircle className="w-6 h-6 text-honeydew-600 dark:text-honeydew-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Real-Time Discussion
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Share insights and get instant feedback from the community
              </p>
            </CardContent>
          </Card>

          <Card className="border border-honeydew-200 dark:border-honeydew-800 hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-honeydew-100 dark:bg-honeydew-900/30">
                <Shield className="w-6 h-6 text-honeydew-600 dark:text-honeydew-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                Exclusive Access
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Subscriber-only channels with premium content and analysis
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            By joining our Discord server, you agree to follow our community guidelines and Discord's Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}

