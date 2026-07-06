import { TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { TrendsTable, TrendsSectionBody, type TrendRowDef } from './TrendsTable';
import type { NbaGameTrends } from './useNbaMatchupOverview';
import type { GameFeedItem } from '../../../types';

/**
 * Betting-facing trend rows (streaks, ATS, O/U hit rate) from the
 * MatchupOverviewModal "Recent Trends" table. Formatting per row is verbatim.
 */
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
          format: (v) => String(v),
        },
        {
          label: 'ATS %',
          away: trends.away_ats_pct,
          home: trends.home_ats_pct,
          format: (v) => `${(v * 100).toFixed(1)}%`,
        },
        {
          label: 'ATS Streak',
          away: trends.away_ats_streak,
          home: trends.home_ats_streak,
          format: (v) => String(v),
        },
        {
          label: 'Last Game Score Margin',
          away: trends.away_last_margin,
          home: trends.home_last_margin,
          format: (v) => v.toFixed(1),
        },
        {
          label: 'Over/Under %',
          away: trends.away_over_pct,
          home: trends.home_over_pct,
          format: (v) => `${(v * 100).toFixed(1)}%`,
        },
      ]
    : [];

  return (
    <WidgetCard icon={<TrendingUp />} title="Betting Trends">
      <TrendsSectionBody loading={loading} trendsAvailable={!!trends}>
        <TrendsTable awayTeam={game.awayTeam} homeTeam={game.homeTeam} rows={rows} />
      </TrendsSectionBody>
    </WidgetCard>
  );
}
