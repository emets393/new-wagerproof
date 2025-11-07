import React, { useState, useEffect, useRef } from 'react';
import { MiniBetSlipGrader } from '@/components/MiniBetSlipGrader';

export function BetSlipGraderCTA() {
  // Only render the interactive chat widget on the client side (after hydration)
  const [isMounted, setIsMounted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Store the current scroll position before component mounts
    const currentScrollY = window.scrollY;
    
    setIsMounted(true);
    
    // Restore scroll position after a short delay to prevent auto-scroll
    const timer = setTimeout(() => {
      if (window.scrollY !== currentScrollY) {
        window.scrollTo({ top: currentScrollY, behavior: 'instant' });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <section 
      ref={sectionRef}
      className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Just for fun, share a bet with us and get roasted.
          </h2>
        </div>
        
        {/* Bet Slip Grader Widget - Only render after client-side hydration */}
        {isMounted ? (
          <MiniBetSlipGrader inline={true} />
        ) : (
          // Placeholder during SSR/pre-render to maintain layout
          <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 h-[700px]">
            <p className="text-gray-500 dark:text-gray-400">Loading chat widget...</p>
          </div>
        )}
      </div>
    </section>
  );
}

