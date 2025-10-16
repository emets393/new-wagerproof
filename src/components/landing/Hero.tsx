
import React from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import LightRays from "@/components/magicui/light-rays";
import { Button } from "@/components/ui/button";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { Link } from "react-router-dom";
import CFBPreview from "./CFBPreview";
import { GradientText } from "@/components/ui/gradient-text";
import { useTheme } from "@/contexts/ThemeContext";

const Hero = () => {
  const { theme } = useTheme();
  
  // Darker colors for better contrast in light mode
  const lightModeGradient = "linear-gradient(90deg, #15803d 0%, #22c55e 20%, #166534 50%, #22c55e 80%, #15803d 100%)";
  // Original colors for dark mode
  const darkModeGradient = "linear-gradient(90deg, #22c55e 0%, #4ade80 20%, #16a34a 50%, #4ade80 80%, #22c55e 100%)";
  
  const gradientToUse = theme === 'light' ? lightModeGradient : darkModeGradient;
  
  // Slower, more elegant animation
  const slowTransition = { duration: 6, repeat: Infinity, ease: "linear" as const };

  return <section className="relative min-h-screen pt-24 md:pt-32 px-4 md:px-6 pb-16 overflow-hidden transition-colors duration-500">
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

          {/* CTA Button */}
          <div className="flex items-center justify-center mb-4">
            <Link to="https://wagerproof.carrd.co/" target="_blank" rel="noopener noreferrer">
              <MovingBorderButton
                borderRadius="1.5rem"
                containerClassName="h-16 w-auto"
                className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-honeydew-600 dark:text-honeydew-400 font-semibold border-gray-300 dark:border-gray-600 text-lg"
                borderClassName="bg-[radial-gradient(#73b69e_40%,transparent_60%)]"
                duration={2500}
              >
                <span className="px-6">Join the Waitlist</span>
              </MovingBorderButton>
            </Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Follow us on Tiktok for free daily predictions and news.
          </p>
        </div>

        {/* Live College Football Preview */}
        <CFBPreview />
      </div>
    </section>;
};
export default Hero;
