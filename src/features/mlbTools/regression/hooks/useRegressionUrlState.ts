import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * URL model for /mlb/daily-regression-report: `?game=<game_pk>`. Absent means
 * the report-wide summary, which is a real destination here rather than an
 * empty state — the overall record, tier performance and methodology live there.
 */
export function useRegressionUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGameId = searchParams.get('game');

  const selectGame = useCallback(
    (gameId: string | null, options?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (gameId) params.set('game', gameId);
          else params.delete('game');
          return params;
        },
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  return { selectedGameId, selectGame };
}
