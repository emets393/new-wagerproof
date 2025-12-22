
import React, { useState } from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import LightRays from "@/components/magicui/light-rays";
import { Button } from "@/components/ui/button";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { Link } from "react-router-dom";
import CFBPreview from "./CFBPreview";
import { GradientText } from "@/components/ui/gradient-text";
import { useTheme } from "@/contexts/ThemeContext";
import { trackCTAClick } from "@/lib/mixpanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const Hero = () => {
  const { theme } = useTheme();
  const [isIOSModalOpen, setIsIOSModalOpen] = useState(false);

  // Darker colors for better contrast in light mode
  const lightModeGradient = "linear-gradient(90deg, #15803d 0%, #22c55e 20%, #166534 50%, #22c55e 80%, #15803d 100%)";
  // Original colors for dark mode
  const darkModeGradient = "linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%)";
  
  const gradientToUse = theme === 'light' ? lightModeGradient : darkModeGradient;
  
  // Slower, more elegant animation
  const slowTransition = { duration: 6, repeat: Infinity, ease: "linear" as const };

  return <section className="relative min-h-screen pt-24 md:pt-32 px-4 md:px-6 pb-4 md:pb-16 overflow-hidden transition-colors duration-500">
      {/* Light Rays Background Effect */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <LightRays
          raysOrigin="top-center"
          raysColor="#39ff14"
          raysSpeed={1}
          lightSpread={0.5}
          rayLength={3.0}
          pulsating={true}
          fadeDistance={1.0}
          saturation={1.0}
          followMouse={true}
          mouseInfluence={0.6}
          noiseAmount={0.}
          distortion={0}
          opacity={0.95}
          additive={true}
          fadeOut={0.2}
        />
      </div>

      {/* Animated decorative green blurred accents */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -left-96 -top-32 w-[700px] h-[380px] bg-gradient-to-br from-honeydew-200/50 to-honeydew-400/40 rounded-full blur-3xl opacity-80 animate-float-slow"></div>
        <div className="absolute -right-80 bottom-0 w-[540px] h-[340px] bg-gradient-to-tl from-honeydew-200/40 to-honeydew-500/20 rounded-full blur-2xl opacity-60 animate-float-delayed"></div>
        <div className="absolute left-1/2 top-1/3 w-[600px] h-[400px] bg-gradient-to-tr from-honeydew-300/30 to-honeydew-400/20 rounded-full blur-3xl opacity-40 animate-float-medium"></div>
      </div>

      {/* Centered container */}
      <div className="relative z-10 max-w-7xl mx-auto w-full flex flex-col items-center justify-center">
        {/* Header Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight font-extrabold leading-tight text-gray-900 dark:text-gray-100 mb-6" style={{
            fontFamily: "Inter, sans-serif"
          }}>
            Turn <GradientText 
              text="Real Data" 
              gradient={gradientToUse}
              transition={slowTransition}
              className="font-bold"
            />
            <br />
            Into Your <GradientText 
              text="Betting Edge" 
              gradient={gradientToUse}
              transition={slowTransition}
              className="font-bold"
            />
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Value focused, lightweight, data-driven sports betting analytics for everyone.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
            <Link
              to="https://wagerproof.bet/account"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCTAClick('Try on Web', 'Hero', 'https://wagerproof.bet/account')}
            >
              <MovingBorderButton
                borderRadius="0.5rem"
                containerClassName="h-[50px] w-[170px]"
                className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-honeydew-600 dark:text-honeydew-400 font-semibold border-gray-300 dark:border-gray-600 text-base"
                borderClassName="bg-[radial-gradient(#73b69e_40%,transparent_60%)]"
                duration={2500}
              >
                <span>Try on Web</span>
              </MovingBorderButton>
            </Link>
            <a
              href="https://play.google.com/store/apps/details?id=com.wagerproof.mobile"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Get it on Google Play"
                style={{ width: '250px', height: '75px', objectFit: 'contain' }}
                width="250"
                height="75"
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
                style={{ width: '160px', height: '54px', objectFit: 'contain' }}
                width="160"
                height="54"
              />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Coming Soon</span>
            </button>
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2 mt-4">
            Follow us on
            <a href="https://twitter.com/wagerproofai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            &
            <a href="https://instagram.com/wagerproof" target="_blank" rel="noopener noreferrer" className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            for free daily picks and analysis.
          </p>
        </div>

        {/* Live College Football Preview */}
        <CFBPreview />
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
    </section>;
};
export default Hero;
