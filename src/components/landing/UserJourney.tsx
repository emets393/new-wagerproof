
import React, { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { useInViewAnimation } from "@/hooks/useInViewAnimation";
import ShineBorder from "@/components/magicui/shine-border";
import GlassIcon from "@/components/magicui/glass-icon";
import MicroChat from "@/components/landing/MicroChat";

const usefulAIStep = {
  title: "Useful AI",
  description: "Our chat assistant uses the real live model data to explain any line, percentage, or rationale to you",
  icon: <Bot />,
  iconColor: "green",
  borderColor: ["#22c55e", "#4ade80", "#22c55e"],
};

const UserJourney = () => {
  const [sectionRef, inView] = useInViewAnimation<HTMLElement>();
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Auto-open chat when section comes into view
  useEffect(() => {
    if (inView) {
      const timer = setTimeout(() => {
        setIsChatOpen(true);
      }, 2000); // Open after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [inView]);

  return (
    <section
      ref={sectionRef}
      id="user-journey"
      className="py-14 bg-transparent"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center max-w-3xl mx-auto mb-12 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            From Data to Decisions in Seconds
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Your seamless journey from raw stats to winning bets
          </p>
        </div>

        {/* Screenshot Image */}
        <div className="mb-0">
          <div className="relative max-w-7xl mx-auto">
            <div className="relative rounded-lg overflow-visible shadow-2xl bg-gray-100 dark:bg-gray-900 pulse-border-container">
              <style>{`
                @keyframes borderPulse {
                  0%, 100% {
                    border-color: rgba(34, 197, 94, 0.4);
                    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
                  }
                  50% {
                    border-color: #22c55e;
                    box-shadow: 0 0 20px 4px rgba(34, 197, 94, 0.6);
                  }
                }
                
                .pulse-border-container {
                  animation: borderPulse 2s ease-in-out infinite;
                  border: 3px solid rgba(34, 197, 94, 0.4) !important;
                }
              `}</style>
              <div className="rounded-lg overflow-hidden relative z-0">
                <img 
                  src="/dashscreen.png"
                  alt="WagerProof Dashboard" 
                  className="w-full h-auto rounded-lg block"
                  loading="lazy"
                />
              </div>
              {/* Micro Chat Overlay - Demo Illustration - Desktop only */}
              <div className="hidden md:block">
                <MicroChat isOpen={isChatOpen} />
              </div>
              
              {/* Useful AI Feature Container - Bottom Left - Desktop only */}
              <div className={`hidden md:block absolute bottom-4 left-4 z-20 w-[280px] sm:w-[320px] pointer-events-none transition-all duration-700 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}>
                <ShineBorder
                  className="h-full w-full bg-white dark:bg-gray-800 shadow-xl"
                  borderRadius={16}
                  borderWidth={1}
                  duration={14}
                  color={usefulAIStep.borderColor}
                >
                  <div className="flex flex-col h-full p-3">
                    <div className="mb-4">
                      <GlassIcon
                        icon={usefulAIStep.icon}
                        color={usefulAIStep.iconColor}
                        label={usefulAIStep.title}
                        size="md"
                        isHovered={false}
                      />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {usefulAIStep.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 flex-grow text-sm">
                      {usefulAIStep.description}
                    </p>
                  </div>
                </ShineBorder>
              </div>
            </div>
            
            {/* Mobile Chat - Stacked below dashboard on small screens */}
            <div className="md:hidden mt-4 relative">
              <div className="relative" style={{ marginTop: '-20px' }}>
                <MicroChat isOpen={isChatOpen} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UserJourney;
