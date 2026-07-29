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
  type LineMarketGroup,
  type LineScalarBundle,
} from '../shared/lineMovement';

interface CfbLineMovementRow {
  snap_ts: string;
  n_books: number | null;
  fg_spread_home: number | null;
  fg_total: number | null;
}

export interface CfbLineMovementInput {
  /** `cfb_slate_games.game_id` — the movement view is keyed on the same id. */
  gameId?: string | number | null;
  season?: number | null;
  away: TeamRef;
  home: TeamRef;
  scalars: LineScalarBundle;
}

/**
 * `cfb_line_movement` only carries FG spread/total. 1H and team totals arrive
 * later in the season; keep their toggles visible but empty so the market list
 * matches NFL and the gap reads as "not posted" rather than a missing feature.
 */
const CFB_GROUPS: LineMarketGroup[] = [
  'spread',
  'total',
  'ml',
  'tt',
  'h1_spread',
  'h1_total',
  'h1_ml',
];

const CONSENSUS_SELECT = 'snap_ts,n_books,fg_spread_home,fg_total';

const toConsensusSnap = (row: CfbLineMovementRow): LineConsensusSnap => ({
  snap_ts: row.snap_ts,
  n_books: toNum(row.n_books),
  fg_spread_home: toNum(row.fg_spread_home),
  fg_total: toNum(row.fg_total),
  h1_spread_home: null,
  h1_total: null,
  tt_home: null,
  tt_away: null,
});

/**
 * One CFB game's line-movement series from the game-keyed consensus view.
 *
 * The raw `ncaaf_odds_history` archive is deliberately not consulted: it is keyed
 * by Odds-API event id and matching it back by team name collides (a `Texas%`
 * prefix also hits Texas A&M, Tech and State). The view owns that remap.
 */
export function useCfbLineMovement(input: CfbLineMovementInput) {
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
        const { data, error: fetchError } = await retryOnStatementTimeout<CfbLineMovementRow>(
          () => {
            let query = collegeFootballSupabase
              .from('cfb_line_movement')
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
          debug.error('Error fetching cfb_line_movement:', fetchError);
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
        debug.error('Error fetching CFB line movement:', err);
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
        groups: CFB_GROUPS,
      }),
    [input.away, input.home, history, input.scalars],
  );

  return { markets, history, loading, error, refetch, hasDataSource: hasIdentity };
}
