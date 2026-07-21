import { ArrowUpRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WidgetCard } from '@/components/ios';
import { MLBRegressionPicksForGame } from '@/components/MLBRegressionPicksForGame';
import { useMLBRegressionReport } from '@/hooks/useMLBRegressionReport';
import { type MLBPredictionRow } from '../../../api/mlbGames';
import { toNum } from './shared';

/**
 * Regression Report picks for this game, wrapped in a WidgetCard. The embedded
 * component returns null when the report has no picks for the game, so we
 * pre-check the same filter to avoid rendering an empty glass shell
 * (React Query dedupes the extra useMLBRegressionReport call).
 */
export function MlbRegressionSection({
  raw,
  awayAbbrev,
  homeAbbrev,
  awayTeamName,
  homeTeamName,
}: {
  raw: MLBPredictionRow;
  awayAbbrev: string;
  homeAbbrev: string;
  awayTeamName: string;
  homeTeamName: string;
}) {
  const { data: report } = useMLBRegressionReport();

  const pkNum = Number(raw.game_pk);
  const gamePk = Number.isNaN(pkNum) ? null : pkNum;
  const hasPicks =
    gamePk !== null && (report?.suggested_picks || []).some((p) => p.game_pk === gamePk);
  if (!hasPicks) return null;

  // Model-side props copied verbatim from the legacy MLB.tsx embed
  // (pick side = team with the higher edge; direction from edge sign).
  const mlPickIsHome = (toNum(raw.home_ml_edge_pct) ?? -999) >= (toNum(raw.away_ml_edge_pct) ?? -999);
  const f5PickIsHome = (toNum(raw.f5_home_ml_edge_pct) ?? -999) >= (toNum(raw.f5_away_ml_edge_pct) ?? -999);

  return (
    <WidgetCard
      icon={<Zap />}
      title="Regression Picks"
      subtitle="Teams whose recent results have run hot or cold versus their underlying stats, and so are due to swing back."
      accessory={
        <Link
          to="/mlb/daily-regression-report"
          className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-primary transition-opacity hover:opacity-80"
        >
          Full report
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      }
    >
      <MLBRegressionPicksForGame
        gamePk={raw.game_pk}
        homeAbbrev={homeAbbrev}
        awayAbbrev={awayAbbrev}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        fullMlPickIsHome={mlPickIsHome}
        f5MlPickIsHome={f5PickIsHome}
        fullOuDir={(raw.ou_direction === 'OVER' || raw.ou_direction === 'UNDER') ? raw.ou_direction : null}
        f5OuDir={toNum(raw.f5_ou_edge) != null ? ((toNum(raw.f5_ou_edge) as number) >= 0 ? 'OVER' : 'UNDER') : null}
      />
    </WidgetCard>
  );
}
