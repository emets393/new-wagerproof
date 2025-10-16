import React from 'react';
import { MiniBetSlipGrader } from '@/components/MiniBetSlipGrader';

export function BetSlipGraderCTA() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Just for fun, share a bet with us and get roasted.
          </h2>
        </div>
        
        {/* Bet Slip Grader Widget */}
        <MiniBetSlipGrader inline={true} />
      </div>
    </section>
  );
}

