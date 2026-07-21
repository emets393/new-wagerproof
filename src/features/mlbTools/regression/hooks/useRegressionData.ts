import { useMemo } from 'react';
import { useMLBRegressionReport } from '@/hooks/useMLBRegressionReport';
import { useMLBSeriesSignals } from '@/hooks/useMLBSeriesSignals';
import { useMLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import { useMLBModelBreakdownAccuracy } from '@/hooks/useMLBModelBreakdownAccuracy';
import { useMLBPerfectStormRecords } from '@/hooks/useMLBPerfectStormRecords';
import { useF5Splits } from '@/hooks/useF5Splits';
import { teamAbbrFromLrSplitName } from '@/utils/f5SplitLabels';
import { buildRegressionFeed } from '../buildFeed';

/**
 * One entry point for everything the page reads. The five existing hooks are
 * reused as-is — this only fans them out and inverts the report payload into a
 * per-game feed (see buildFeed.ts).
 */
export function useRegressionData() {
  const { data: report, isLoading, error, refetch } = useMLBRegressionReport();
  const { data: seriesSignals = [] } = useMLBSeriesSignals();
  const { data: bucketAccuracy } = useMLBBucketAccuracy();
  const { data: breakdownRows = [] } = useMLBModelBreakdownAccuracy();
  const { data: tierRecords } = useMLBPerfectStormRecords();

  // The F5 split matrix is only fetched for the teams the report's L/R section
  // names, which is why it can't move into buildFeed (it needs its own query).
  const lrSplitTeamAbbrs = useMemo(
    () =>
      [
        ...new Set((report?.lr_splits_today ?? []).map((s) => teamAbbrFromLrSplitName(s.team_name))),
      ].filter(Boolean),
    [report?.lr_splits_today],
  );
  const { data: f5SplitsData } = useF5Splits(lrSplitTeamAbbrs);

  const games = useMemo(
    () => buildRegressionFeed(report, seriesSignals),
    [report, seriesSignals],
  );

  return {
    report: report ?? null,
    games,
    isLoading,
    error,
    refetch,
    bucketAccuracy: bucketAccuracy ?? null,
    breakdownRows,
    tierRecords: tierRecords ?? null,
    f5SplitLookup: f5SplitsData?.lookup ?? EMPTY_SPLIT_LOOKUP,
  };
}

// Stable identity so consumers memoizing on the lookup don't rerun every render.
const EMPTY_SPLIT_LOOKUP = new Map<string, import('@/types/mlbF5Splits').F5SplitRow>();

export type RegressionData = ReturnType<typeof useRegressionData>;
