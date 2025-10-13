import React from "react";
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";
import { useIsMobile } from "@/hooks/use-mobile";

const FloatingThemeToggle = () => {
  const isMobile = useIsMobile();

  // Only render on mobile devices
  if (!isMobile) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 md:hidden">
      <div className="relative">
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-honeydew-400 to-honeydew-600 opacity-20 blur-xl animate-pulse" />
        
        {/* Button container with shadow */}
        <div className="relative bg-white dark:bg-gray-800 rounded-full p-3 shadow-2xl border border-honeydew-400/30 dark:border-honeydew-600/30 backdrop-blur-sm">
          <AnimatedThemeToggler className="scale-125" />
        </div>
      </div>
    </div>
  );
};

export default FloatingThemeToggle;