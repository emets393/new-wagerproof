import { TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import {
  TrendRows,
  TrendsSectionBody,
  TrendsTeamHeader,
  type TrendRowDef,
} from './TrendsTable';
import type { NbaGameTrends } from './useNbaMatchupOverview';
import type { GameFeedItem } from '../../../types';

/**
 * How each side has been betting lately: streaks, ATS rate, O/U rate.
 *
 * Streak columns are signed — a negative `win_streak` is a losing streak — so
 * they're rendered as W5 / L2 rather than as a bare minus sign.
 */
const formatStreak = (value: number): string =>
  value >= 0 ? `W${value}` : `L${Math.abs(value)}`;

const formatAtsStreak = (value: number): string =>
  value >= 0 ? `${value} cover${value === 1 ? '' : 's'}` : `${Math.abs(value)} miss${value === -1 ? '' : 'es'}`;

const formatPct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/** Break-even at -110 juice. A 51% ATS team is still losing money. */
const BREAK_EVEN_PCT = 52.4;

export function NbaBettingTrendsSection({
  game,
  trends,
  loading,
}: {
  game: GameFeedItem;
  trends: NbaGameTrends | null;
  loading: boolean;
}) {
  const rows: TrendRowDef[] = trends
    ? [
        {
          label: 'Win Streak',
          away: trends.away_win_streak,
          home: trends.home_win_streak,
          format: formatStreak,
          diffCap: 5,
        },
        {
          label: 'ATS Streak',
          away: trends.away_ats_streak,
          home: trends.home_ats_streak,
          format: formatAtsStreak,
          diffCap: 5,
        },
        {
          label: 'Last Game Margin',
          away: trends.away_last_margin,
          home: trends.home_last_margin,
          format: (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)),
          diffCap: 15,
        },
        {
          label: 'Cover Rate (ATS)',
          away: trends.away_ats_pct,
          home: trends.home_ats_pct,
          format: formatPct,
          meter: { threshold: BREAK_EVEN_PCT, hint: `break-even ${BREAK_EVEN_PCT}%` },
        },
        {
          label: 'Games Going Over',
          away: trends.away_over_pct,
          home: trends.home_over_pct,
          format: formatPct,
          // Neither direction is "better" on a total — the tick is just the
          // coin-flip line so an over- or under-leaning team stands out.
          meter: { threshold: 50, hint: 'coin flip at 50%' },
        },
      ]
    : [];

  return (
    <WidgetCard
      icon={<TrendingUp />}
      title="Betting Trends"
      subtitle="How each team has been running lately — win and cover streaks, and how often their games clear the number."
    >
      <TrendsSectionBody loading={loading} trendsAvailable={!!trends}>
        <TrendsTeamHeader awayTeam={game.awayTeam} homeTeam={game.homeTeam} />
        <TrendRows awayTeam={game.awayTeam} homeTeam={game.homeTeam} rows={rows} />
      </TrendsSectionBody>
    </WidgetCard>
  );
}
