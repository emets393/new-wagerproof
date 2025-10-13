
import React from "react";
import { AuroraText } from "@/components/magicui/aurora-text";
import LightRays from "@/components/magicui/light-rays";
import { Button } from "@/components/ui/button";
import { Button as MovingBorderButton } from "@/components/ui/moving-border";
const wagerProofIcon = "/wagerproof-landing.png";
const Hero = () => {
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
            Turn <AuroraText className="font-bold text-honeydew-600 dark:text-honeydew-400">Real Data</AuroraText>
            <br />
            Into Your <AuroraText className="font-bold text-honeydew-600 dark:text-honeydew-400">Betting Edge</AuroraText>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-8">
            Next-gen, open source, lightweight, data-driven sports betting analytics for everyone.
          </p>

          {/* CTA Button */}
          <div className="flex items-center justify-center mb-4">
            <MovingBorderButton
              borderRadius="1.5rem"
              containerClassName="h-16 w-auto"
              className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-honeydew-600 dark:text-honeydew-400 font-semibold border-gray-300 dark:border-gray-600 text-lg"
              borderClassName="bg-[radial-gradient(#73b69e_40%,transparent_60%)]"
              duration={2500}
              onClick={() => window.location.href = 'https://www.wagerproof.bet/nfl'}
            >
              <span className="px-6">See Today's Games and Picks</span>
            </MovingBorderButton>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Follow us on Tiktok for free daily predictions and news.
          </p>
        </div>

        {/* Dashboard Preview Placeholder */}
        <div className="w-full max-w-6xl mx-auto mt-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-2xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            {/* Dashboard Header */}
            <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={wagerProofIcon} alt="WagerProof" className="w-8 h-8 rounded" />
                <span className="font-semibold text-gray-900 dark:text-gray-100">wagerproof.bet</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 rounded bg-honeydew-100 dark:bg-honeydew-900/30 text-honeydew-700 dark:text-honeydew-400 text-sm font-medium">
                  <span className="w-2 h-2 bg-honeydew-500 rounded-full animate-pulse"></span>
                  Live
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Today</span>
              </div>
            </div>
            
            {/* Dashboard Content Placeholder */}
            <div className="p-6 md:p-8 lg:p-10 min-h-[500px] flex flex-col gap-6">
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Win Rate</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">64.2%</div>
                  <div className="text-xs text-honeydew-600 dark:text-honeydew-400 mt-1">↑ 12.4%</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Active Bets</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">127</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">This week</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">ROI</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">+18.3%</div>
                  <div className="text-xs text-honeydew-600 dark:text-honeydew-400 mt-1">↑ 5.2%</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Sharp Plays</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">23</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Today</div>
                </div>
              </div>

              {/* Chart Placeholder */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 flex-1 min-h-[300px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Performance Analytics</h3>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Last 30 days</div>
                </div>
                <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-600">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm">Live Analytics Dashboard</p>
                    <p className="text-xs mt-1">Track your betting performance in real-time</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>;
};
export default Hero;
