import { useState } from 'react';
import { Smartphone, Zap, Bot } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function MobileApp() {
  const [isIOSModalOpen, setIsIOSModalOpen] = useState(false);

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
              Available on Android • iOS coming soon
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

              {/* Apple App Store Badge - Coming Soon */}
              <button
                onClick={() => setIsIOSModalOpen(true)}
                className="relative flex items-center opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <img
                  src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                  alt="Download on the App Store"
                  style={{ width: '140px', height: '47px', objectFit: 'contain' }}
                  width="140"
                  height="47"
                />
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Coming Soon</span>
              </button>
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

      {/* iOS Coming Soon Modal */}
      <Dialog open={isIOSModalOpen} onOpenChange={setIsIOSModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Coming Soon to iOS!</DialogTitle>
            <DialogDescription className="text-center pt-4">
              <div className="flex justify-center mb-4">
                <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                We're working hard to bring WagerProof to the App Store.
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                In the meantime, you can use our web app or download the Android version.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => setIsIOSModalOpen(false)}
              className="bg-honeydew-500 hover:bg-honeydew-600 text-white"
            >
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
