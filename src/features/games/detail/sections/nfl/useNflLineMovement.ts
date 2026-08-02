import { useCallback, useEffect, useMemo, useState } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import type { TeamRef } from '../../../types';
import {
  LINE_MOVEMENT_TIMEOUT_ERROR,
  buildLineMarkets,
  isTimeoutError,
  retryOnStatementTimeout,
  toNum,
  type LineConsensusSnap,
  type LineMarket,
  type LineScalarBundle,
} from '../shared/lineMovement';

interface NflLineMovementRow {
  snap_ts: string;
  n_books: number | null;
  fg_spread_home: number | null;
  fg_total: number | null;
  h1_spread_home: number | null;
  h1_total: number | null;
  tt_home: number | null;
  tt_away: number | null;
}

export interface NflLineMovementInput {
  /** `nfl_slate_games.game_id` — the movement view is keyed on the same id. */
  gameId?: string | number | null;
  season?: number | null;
  away: TeamRef;
  home: TeamRef;
  scalars: LineScalarBundle;
}

const CONSENSUS_SELECT =
  'snap_ts,n_books,fg_spread_home,fg_total,h1_spread_home,h1_total,tt_home,tt_away';

const toConsensusSnap = (row: NflLineMovementRow): LineConsensusSnap => ({
  snap_ts: row.snap_ts,
  n_books: toNum(row.n_books),
  fg_spread_home: toNum(row.fg_spread_home),
  fg_total: toNum(row.fg_total),
  h1_spread_home: toNum(row.h1_spread_home),
  h1_total: toNum(row.h1_total),
  tt_home: toNum(row.tt_home),
  tt_away: toNum(row.tt_away),
});

/**
 * One NFL game's line-movement series from the game-keyed consensus view.
 *
 * `nfl_historical_odds` is deliberately not consulted: it is keyed by city name,
 * and the view already remaps it onto the `game_id` the cards use. Moneyline has
 * no column in the view, so those markets fall back to the slate close.
 */
export function useNflLineMovement(input: NflLineMovementInput) {
  const [history, setHistory] = useState<LineConsensusSnap[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);
  const hasIdentity = input.gameId !== null && input.gameId !== undefined && input.gameId !== '';

  useEffect(() => {
    if (!hasIdentity) {
      setHistory([]);
      setError(null);
      return;
    }

    let cancelled = false;

    const fetchLines = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await retryOnStatementTimeout<NflLineMovementRow>(
          () => {
            let query = collegeFootballSupabase
              .from('nfl_line_movement')
              .select(CONSENSUS_SELECT)
              .eq('game_id', String(input.gameId))
              .order('snap_ts', { ascending: true });
            if (input.season != null) {
              query = query.eq('season', Number(input.season));
            }
            return query;
          },
        );
        if (cancelled) return;

        if (fetchError) {
          // No rows means "not posted yet", but a timeout means we simply failed to
          // load — say so instead of passing the slate close off as the whole story.
          debug.error('Error fetching nfl_line_movement:', fetchError);
          setHistory([]);
          setError(
            isTimeoutError(fetchError)
              ? LINE_MOVEMENT_TIMEOUT_ERROR
              : 'Failed to load line movement.',
          );
          return;
        }

        setHistory((data ?? []).map(toConsensusSnap));
      } catch (err) {
        debug.error('Error fetching NFL line movement:', err);
        if (!cancelled) {
          setHistory([]);
          setError('An unexpected error occurred');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchLines();
    return () => {
      cancelled = true;
    };
  }, [hasIdentity, input.gameId, input.season, reloadToken]);

  const markets: LineMarket[] = useMemo(
    () =>
      buildLineMarkets({
        away: input.away,
        home: input.home,
        history,
        scalars: input.scalars,
        includeEmpty: true,
      }),
    [input.away, input.home, history, input.scalars],
  );

  return { markets, history, loading, error, refetch, hasDataSource: hasIdentity };
}
