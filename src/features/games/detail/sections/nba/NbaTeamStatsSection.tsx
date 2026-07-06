import { BarChart3 } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { TrendsTable, TrendsSectionBody, type TrendRowDef } from './TrendsTable';
import type { NbaGameTrends } from './useNbaMatchupOverview';
import type { GameFeedItem } from '../../../types';

/**
 * Team-quality rows (ratings + L3 pace/off/def trends) from the
 * MatchupOverviewModal "Recent Trends" table. Formatting per row is verbatim;
 * defensive-trend coloring stays inverted via getTrendColor's label match.
 */
export function NbaTeamStatsSection({
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
          label: 'Overall Rating',
          away: trends.away_ovr_rtg,
          home: trends.home_ovr_rtg,
          format: (v) => v.toFixed(2),
        },
        {
          label: 'Consistency Rating',
          away: trends.away_consistency,
          home: trends.home_consistency,
          format: (v) => v.toFixed(2),
        },
        {
          label: 'Pace Trend (Last 3)',
          away: trends.away_adj_pace_pregame_l3_trend,
          home: trends.home_adj_pace_pregame_l3_trend,
          format: (v) => v.toFixed(2),
        },
        {
          label: 'Offensive Rating Trend (Last 3)',
          away: trends.away_adj_off_rtg_pregame_l3_trend,
          home: trends.home_adj_off_rtg_pregame_l3_trend,
          format: (v) => v.toFixed(2),
        },
        {
          label: 'Defensive Rating Trend (Last 3)',
          away: trends.away_adj_def_rtg_pregame_l3_trend,
          home: trends.home_adj_def_rtg_pregame_l3_trend,
          format: (v) => v.toFixed(2),
        },
      ]
    : [];

  return (
    <WidgetCard icon={<BarChart3 />} title="Team Stats" className="@xl:col-span-2">
      <TrendsSectionBody loading={loading} trendsAvailable={!!trends}>
        <TrendsTable awayTeam={game.awayTeam} homeTeam={game.homeTeam} rows={rows} />
      </TrendsSectionBody>
    </WidgetCard>
  );
}
