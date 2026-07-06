import { Timer } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { useMLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import { useMLBModelBreakdownAccuracy } from '@/hooks/useMLBModelBreakdownAccuracy';
import { type MLBPredictionRow } from '../../../api/mlbGames';
import { F5MlPanel, F5TotalPanel, toNum } from './shared';

/**
 * Always-visible first-five splits (the F5 branch of the legacy projection
 * toggle): F5 moneyline + F5 total picks with bucket-accuracy badges and
 * historical model context, so F5 value is scannable without flipping the
 * Projected Score toggle. Hidden entirely when the row carries no F5 model
 * data (off-slate / preliminary rows).
 */
export function MlbFirstFiveSection({
  raw,
  awayAbbrev,
  homeAbbrev,
}: {
  raw: MLBPredictionRow;
  awayAbbrev: string;
  homeAbbrev: string;
}) {
  const { data: modelAccuracy } = useMLBBucketAccuracy();
  const { data: breakdownRows = [] } = useMLBModelBreakdownAccuracy();

  const hasF5Data =
    toNum(raw.f5_fair_total) !== null ||
    toNum(raw.f5_home_win_prob) !== null ||
    toNum(raw.f5_away_win_prob) !== null ||
    toNum(raw.f5_home_ml_edge_pct) !== null ||
    toNum(raw.f5_away_ml_edge_pct) !== null ||
    toNum(raw.f5_ou_edge) !== null;
  if (!hasF5Data) return null;

  const panelProps = { raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows };

  return (
    <WidgetCard icon={<Timer />} title="First-Five Splits">
      <div className="space-y-3">
        <F5MlPanel {...panelProps} />
        <F5TotalPanel {...panelProps} />
      </div>
    </WidgetCard>
  );
}
