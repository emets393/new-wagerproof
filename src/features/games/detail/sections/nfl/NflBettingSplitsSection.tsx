import { BarChart, Target, TrendingUp, Users } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import type { NFLPrediction } from '../../../api/nflGames';

interface ParsedBettingSplit {
  team: string;
  percentage: number;
  isSharp: boolean;
  isPublic: boolean;
  /** For totals: "over" or "under". */
  direction?: string;
}

// Port of NFL.tsx parseBettingSplit — the modal received it as a prop.
const parseBettingSplit = (label: string | null): ParsedBettingSplit | null => {
  if (!label) return null;

  const lowerLabel = label.toLowerCase();

  const percentMatch = label.match(/(\d+)%/);
  const percentage = percentMatch ? parseInt(percentMatch[1]) : 50;

  const isSharp = lowerLabel.includes('sharp');
  const isPublic = lowerLabel.includes('public');

  let team = '';
  let direction: string | undefined = undefined;

  // Check for Over/Under (for totals)
  if (lowerLabel.includes('over')) {
    direction = 'over';
    team = 'Over';
  } else if (lowerLabel.includes('under')) {
    direction = 'under';
    team = 'Under';
  } else {
    // Extract team name (usually after "on" keyword)
    const teamMatch = label.match(/on\s+([A-Za-z\s]+?)(?:\s*\(|$)/);
    if (teamMatch) {
      team = teamMatch[1].trim();
    }
  }

  return { team, percentage, isSharp, isPublic, direction };
};

// Sharp money = green, heavy public lean = purple/blue — same tiers as the modal.
const splitBgClass = (data: ParsedBettingSplit): string => {
  const colorTheme = data.isSharp
    ? 'green'
    : data.percentage >= 70
      ? 'purple'
      : data.percentage >= 60
        ? 'blue'
        : 'neutral';
  return colorTheme === 'green'
    ? 'bg-green-100 dark:bg-green-500/10 border-green-300 dark:border-green-500/20'
    : colorTheme === 'purple'
      ? 'bg-purple-100 dark:bg-purple-500/10 border-purple-300 dark:border-purple-500/20'
      : colorTheme === 'blue'
        ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-300 dark:border-blue-500/20'
        : 'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/20';
};

/**
 * Public Betting Facts, ported from GameDetailsModal's NFL splits block:
 * sportsbook money-flow lean badges parsed from the *_splits_label fields.
 */
export function NflBettingSplitsSection({ raw }: { raw: NFLPrediction }) {
  if (!raw.ml_splits_label && !raw.spread_splits_label && !raw.total_splits_label) return null;

  return (
    <WidgetCard icon={<Users />} title="Public Betting Facts" contentClassName="space-y-3">
      {/* Description explaining the data source */}
      <p className="text-xs text-gray-600 dark:text-white/70 text-center px-2">
        While <span className="font-semibold">Public Betting Lines</span> shows live prediction
        market contracts being bought,
        <span className="font-semibold"> Public Betting Facts</span> is a separate data source
        tracking the lean of actual sportsbook money flow and bets placed.
      </p>

      {/* Betting splits badges - always visible */}
      <div className="flex flex-wrap justify-center gap-2">
        {raw.ml_splits_label &&
          (() => {
            const mlData = parseBettingSplit(raw.ml_splits_label);
            if (!mlData || !mlData.team) return null;
            return (
              <div
                key="ml"
                className={`${splitBgClass(mlData)} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}
              >
                <TrendingUp className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  ML: {mlData.team}
                </span>
              </div>
            );
          })()}
        {raw.spread_splits_label &&
          (() => {
            const spreadData = parseBettingSplit(raw.spread_splits_label);
            if (!spreadData || !spreadData.team) return null;
            return (
              <div
                key="spread"
                className={`${splitBgClass(spreadData)} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}
              >
                <Target className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Spread: {spreadData.team}
                </span>
              </div>
            );
          })()}
        {raw.total_splits_label &&
          (() => {
            const totalData = parseBettingSplit(raw.total_splits_label);
            if (!totalData || !totalData.direction) return null;
            return (
              <div
                key="total"
                className={`${splitBgClass(totalData)} backdrop-blur-sm rounded-lg border px-3 py-2 flex items-center gap-2`}
              >
                <BarChart className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Total: {totalData.direction === 'over' ? 'Over' : 'Under'}
                </span>
              </div>
            );
          })()}
      </div>
    </WidgetCard>
  );
}
