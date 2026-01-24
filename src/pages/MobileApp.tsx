import { Smartphone, Zap, Bot } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MobileApp() {

  const features = [
    {
      icon: Zap,
      title: 'Faster Performance',
      description: 'Native app speed with optimized animations and transitions',
    },
    {
      icon: Bot,
      title: 'WagerBot Clippie Mode',
      description: 'Automatic analysis and tips while you browse games',
    },
    {
      icon: Smartphone,
      title: 'Optimized Mobile UI',
      description: 'Easier readability and touch-friendly mobile features',
    },
  ];

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
        {/* Header */}
        <div className="flex items-center justify-center w-20 h-20 rounded-full bg-honeydew-100 dark:bg-honeydew-900/30 mb-2">
          <Smartphone className="w-10 h-10 text-honeydew-600 dark:text-honeydew-400" />
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Get the Mobile App
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl">
            Download WagerProof for a faster, more optimized mobile experience with exclusive features.
          </p>
        </div>

        {/* Download Badges */}
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Download Now</CardTitle>
            <CardDescription>
              Available on Android and iOS
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <div className="flex items-center justify-center gap-6 flex-wrap">
              {/* Google Play Badge */}
              <a
                href="https://play.google.com/store/apps/details?id=com.wagerproof.mobile"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
              >
                <img
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                  alt="Get it on Google Play"
                  style={{ width: '200px', height: '60px', objectFit: 'contain' }}
                  width="200"
                  height="60"
                />
              </a>

              {/* Apple App Store Badge */}
              <a
                href="https://apps.apple.com/us/app/wagerproof-sports-picks-ai/id6757089957"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center"
              >
                <img
                  src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                  alt="Download on the App Store"
                  style={{ width: '140px', height: '47px', objectFit: 'contain' }}
                  width="140"
                  height="47"
                />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="w-full max-w-2xl">
          <h2 className="text-xl font-semibold text-center mb-6 text-gray-900 dark:text-white">
            Why Use the Mobile App?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="text-center">
                <CardContent className="pt-6">
                  <div className="flex justify-center mb-3">
                    <div className="p-2 rounded-full bg-honeydew-100 dark:bg-honeydew-900/30">
                      <feature.icon className="w-6 h-6 text-honeydew-600 dark:text-honeydew-400" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Web alternative note */}
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Don't want to download? No problem! The web app works great on mobile browsers too.
        </p>
      </div>

    </div>
  );
}
