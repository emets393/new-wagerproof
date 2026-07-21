import { BarChart3 } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { Disclosure } from './shared';
import {
  advantageSummary,
  TrendRows,
  TrendsSectionBody,
  TrendsTeamHeader,
  type TrendRowDef,
} from './TrendsTable';
import type { NbaGameTrends } from './useNbaMatchupOverview';
import type { GameFeedItem } from '../../../types';

/**
 * Team quality (season-long ratings) with the last-3-game trends tucked behind
 * a disclosure — the ratings answer "who's better", the trends answer "who's
 * playing better right now", and only the first belongs on screen by default.
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
  const seasonRows: TrendRowDef[] = trends
    ? [
        {
          label: 'Net Rating',
          away: trends.away_ovr_rtg,
          home: trends.home_ovr_rtg,
          format: (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)),
          diffCap: 6,
        },
        {
          label: 'Consistency',
          away: trends.away_consistency,
          home: trends.home_consistency,
          format: (v) => v.toFixed(1),
          diffCap: 5,
        },
      ]
    : [];

  const trendRows: TrendRowDef[] = trends
    ? [
        {
          label: 'Offense (Last 3)',
          away: trends.away_adj_off_rtg_pregame_l3_trend,
          home: trends.home_adj_off_rtg_pregame_l3_trend,
          format: (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)),
          diffCap: 5,
        },
        {
          label: 'Defense (Last 3)',
          away: trends.away_adj_def_rtg_pregame_l3_trend,
          home: trends.home_adj_def_rtg_pregame_l3_trend,
          format: (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)),
          // Points allowed: a falling defensive rating is the good direction.
          direction: 'lower',
          diffCap: 5,
        },
        {
          label: 'Pace (Last 3)',
          away: trends.away_adj_pace_pregame_l3_trend,
          home: trends.home_adj_pace_pregame_l3_trend,
          format: (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)),
          // Playing faster isn't better or worse, so no winner is colored — the
          // old table green/red'd the higher number, which read as a verdict.
          direction: 'neutral',
          diffCap: 3,
        },
      ]
    : [];

  const trendSummary = advantageSummary(trendRows, game.awayTeam.abbrev, game.homeTeam.abbrev);

  return (
    <WidgetCard
      icon={<BarChart3 />}
      title="Team Stats"
      subtitle="Which side is the better team on the season, and which one has been playing better over its last three games."
      className="@xl:col-span-2"
    >
      <TrendsSectionBody loading={loading} trendsAvailable={!!trends}>
        <TrendsTeamHeader awayTeam={game.awayTeam} homeTeam={game.homeTeam} />
        <TrendRows awayTeam={game.awayTeam} homeTeam={game.homeTeam} rows={seasonRows} />
        <div className="border-t border-black/5 pt-2 dark:border-white/10">
          <Disclosure label="Last-3 game trends" summary={trendSummary ?? undefined}>
            <p className="mb-1 text-[10px] leading-snug text-muted-foreground/80">
              How each team's offense, defense, and pace over its last three games compares to its
              season baseline. Positive means faster or higher-scoring than usual.
            </p>
            <TrendRows awayTeam={game.awayTeam} homeTeam={game.homeTeam} rows={trendRows} />
          </Disclosure>
        </div>
      </TrendsSectionBody>
    </WidgetCard>
  );
}
