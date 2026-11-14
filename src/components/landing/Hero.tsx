
import React from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import LightRays from "@/components/magicui/light-rays";
import { Button } from "@/components/ui/button";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
import { Link } from "react-router-dom";
import CFBPreview from "./CFBPreview";
import { GradientText } from "@/components/ui/gradient-text";
import { useTheme } from "@/contexts/ThemeContext";
import { trackCTAClick } from "@/lib/mixpanel";
import { HEADER_SOCIALS } from "@/lib/socialLinks";

const Hero = () => {
  const { theme } = useTheme();

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
            <GradientText
              text="Build bots"
              gradient={gradientToUse}
              transition={slowTransition}
              className="font-bold"
            />{" "}
            that find{" "}
            <GradientText
              text="plays"
              gradient={gradientToUse}
              transition={slowTransition}
              className="font-bold"
            />{" "}
            for you
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Get access to professional-grade predictions & data for NFL, College Football, and more.
          </p>

          {/* CTA: App Store → Play Store → Try on Web (stacked mobile, row desktop) */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-4">
            <a
              href="https://apps.apple.com/us/app/wagerproof-sports-picks-ai/id6757089957"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download on the App Store"
                className="w-[120px] h-[40px] md:w-[160px] md:h-[54px] object-contain"
              />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.wagerproof.mobile"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Get it on Google Play"
                className="w-[180px] h-[54px] md:w-[250px] md:h-[75px] object-contain"
              />
            </a>
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
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2 mt-4">
            Follow us on
            {HEADER_SOCIALS.map((s, i) => (
              <React.Fragment key={s.platform}>
                {i > 0 && "&"}
                <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`WagerProof on ${s.label}`} className="inline-flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d={s.iconPath} />
                  </svg>
                </a>
              </React.Fragment>
            ))}
            for free daily picks and analysis.
          </p>
        </div>

        {/* Live Sports Preview */}
        <CFBPreview />
      </div>

    </section>;
};
export default Hero;
