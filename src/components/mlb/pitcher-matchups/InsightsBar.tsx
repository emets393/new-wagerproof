import React from 'react';
import type { Insight } from '@/types/mlb-matchups';
import { InsightChips } from './InsightChips';

interface InsightsBarProps {
  insights: Insight[];
}

export function InsightsBar({ insights }: InsightsBarProps) {
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Matchup insights
      </p>
      <InsightChips insights={insights} />
    </div>
  );
}
