import * as React from 'react';
import { Target } from 'lucide-react';
import { SegmentedControl, WidgetCard } from '@/components/ios';
import { useMLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import { useMLBModelBreakdownAccuracy } from '@/hooks/useMLBModelBreakdownAccuracy';
import { getF5Runs, getFullGameRuns, type MLBPredictionRow } from '../../../api/mlbGames';
import {
  F5MlPanel,
  F5TotalPanel,
  FullMlPanel,
  FullTotalPanel,
  ScoreLogoDisc,
} from './shared';

type ProjectionView = 'full' | 'f5';

/**
 * Legacy MLB.tsx projections block: Full Game / 1st 5 toggle switching the
 * Pythagorean projected-score row plus the Moneyline and Total projection
 * panels (accuracy badges + historical model context). Mount with
 * key={game.id} so the view resets to 'full' per game, matching the legacy
 * per-game projectionViewByGame default.
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
  // Model accuracy comes from the dedicated mlb_model_bucket_accuracy table;
  // breakdown rows feed the per-pick historical trend explanations.
  const { data: modelAccuracy } = useMLBBucketAccuracy();
  const { data: breakdownRows = [] } = useMLBModelBreakdownAccuracy();

  const fullRuns = getFullGameRuns(raw);
  const f5Runs = getF5Runs(raw);
  const activeRuns = view === 'full' ? fullRuns : f5Runs;

  const panelProps = { raw, awayAbbrev, homeAbbrev, modelAccuracy, breakdownRows };

  return (
    <WidgetCard
      icon={<Target />}
      title="Projected Score"
      accessory={
        <SegmentedControl
          size="sm"
          options={[
            { value: 'full', label: 'Full Game' },
            { value: 'f5', label: '1st 5' },
          ]}
          value={view}
          onChange={setView}
        />
      }
    >
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">
            Projected Score ({view === 'full' ? 'Full Game' : '1st 5'})
          </div>
          {activeRuns ? (
            <div className="mx-auto flex max-w-md items-center justify-center gap-3 sm:gap-5">
              <ScoreLogoDisc url={awayLogoUrl} abbrev={awayAbbrev} title={awayTeamName} />
              <div className="flex min-w-[6.5rem] items-center justify-center px-1 sm:min-w-[7.5rem]">
                <div className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                  <span>{activeRuns.away.toFixed(1)}</span>
                  <span className="mx-2 font-normal text-muted-foreground">—</span>
                  <span>{activeRuns.home.toFixed(1)}</span>
                </div>
              </div>
              <ScoreLogoDisc url={homeLogoUrl} abbrev={homeAbbrev} title={homeTeamName} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Projection unavailable</div>
          )}
        </div>

        {view === 'full' ? (
          <>
            <FullMlPanel {...panelProps} />
            <FullTotalPanel {...panelProps} />
          </>
        ) : (
          <>
            <F5MlPanel {...panelProps} />
            <F5TotalPanel {...panelProps} />
          </>
        )}
      </div>
    </WidgetCard>
  );
}
