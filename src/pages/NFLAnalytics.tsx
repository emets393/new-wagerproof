import React from 'react';
import NFLFilterableWinRates from '@/components/NFLFilterableWinRates';

export default function NFLAnalytics() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-primary mb-4">NFL Analytics</h1>
        <p className="text-lg text-muted-foreground">
          Analyze NFL team and game performance with advanced filtering options. 
          Toggle between individual team analysis (2 rows per game) and game-level analysis (1 row per game).
        </p>
      </div>
      
      <NFLFilterableWinRates />
    </div>
  );
}
