import * as React from 'react';
import { Target } from 'lucide-react';
import { SegmentedControl, WidgetCard } from '@/components/ios';
import { getF5Runs, getFullGameRuns, type MLBPredictionRow } from '../../../api/mlbGames';
import { ScoreLogoDisc } from './shared';
import { hasF5Data } from './MlbMarketSection';

type ProjectionView = 'full' | 'f5';

/**
 * The model's projected final score, and nothing else.
 *
 * This card used to also carry both market panels (and First-Five Splits
 * repeated the F5 ones), which made it the densest thing on the page. The
 * moneyline and total recommendations now live in their own widgets — see
 * MlbMarketSection — so this answers one question: what does the model think
 * the score will be.
 */
export function MlbProjectedScoreSection({
  raw,
  awayAbbrev,
  homeAbbrev,
  awayLogoUrl,
  homeLogoUrl,
  awayTeamName,
  homeTeamName,
}: {
  raw: MLBPredictionRow;
  awayAbbrev: string;
  homeAbbrev: string;
  awayLogoUrl: string | null;
  homeLogoUrl: string | null;
  awayTeamName: string;
  homeTeamName: string;
}) {
  const [view, setView] = React.useState<ProjectionView>('full');

  const fullRuns = getFullGameRuns(raw);
  const f5Runs = getF5Runs(raw);
  const showToggle = hasF5Data(raw) && f5Runs !== null;
  const active = showToggle ? view : 'full';
  const activeRuns = active === 'full' ? fullRuns : f5Runs;

  return (
    <WidgetCard
      icon={<Target />}
      title="Projected Score"
      subtitle="The model's expected final score. Everything below builds on these run estimates."
      accessory={
        showToggle ? (
          <SegmentedControl
            size="sm"
            options={[
              { value: 'full', label: 'Full Game' },
              { value: 'f5', label: '1st 5' },
            ]}
            value={active}
            // Wrapped, not `onChange={setView}`: a Dispatch<SetStateAction<T>>
            // accepts `T | ((prev) => T)`, so SegmentedControl's `T extends string`
            // infers a function type and collapses T to `string`.
            onChange={(value) => setView(value as ProjectionView)}
          />
        ) : undefined
      }
    >
      {activeRuns ? (
        <div className="flex items-center justify-center gap-4 py-1 sm:gap-6">
          <div className="flex flex-col items-center gap-1.5">
            <ScoreLogoDisc url={awayLogoUrl} abbrev={awayAbbrev} title={awayTeamName} />
            <span className="text-[11px] font-bold text-muted-foreground">{awayAbbrev}</span>
          </div>
          <div className="flex items-baseline gap-2 text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
            <span>{activeRuns.away.toFixed(1)}</span>
            <span className="text-xl font-normal text-muted-foreground sm:text-2xl">—</span>
            <span>{activeRuns.home.toFixed(1)}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <ScoreLogoDisc url={homeLogoUrl} abbrev={homeAbbrev} title={homeTeamName} />
            <span className="text-[11px] font-bold text-muted-foreground">{homeAbbrev}</span>
          </div>
        </div>
      ) : (
        <p className="py-2 text-center text-sm text-muted-foreground">Projection unavailable</p>
      )}
    </WidgetCard>
  );
}
