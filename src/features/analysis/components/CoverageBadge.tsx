import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AnalysisResponse } from './adapters/types';

/** "Based on N games, YYYY–YYYY" + a "Limited history (2023+)" flag on 2023+-only markets. */
export function CoverageBadge({
  data,
  loading,
  limited,
  mlbCoverageText,
}: {
  data: AnalysisResponse | null | undefined;
  loading: boolean;
  limited: boolean;
  /** MLB shows "N bets across M games" instead of the football wording. */
  mlbCoverageText?: boolean;
}) {
  const cov = data?.coverage;
  const text = cov
    ? mlbCoverageText
      ? `${cov.n_bets} bets across ${cov.n_games} games, ${cov.season_min}–${cov.season_max}`
      : `Based on ${cov.n_games} games, ${cov.season_min}–${cov.season_max}`
    : loading
      ? 'Loading…'
      : 'No games match';
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="secondary">{text}</Badge>
      {limited && (
        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
          Limited history (2023+)
        </Badge>
      )}
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}
