import { useEffect, useState } from 'react';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import { buildNflBettingLinesKey } from '@/utils/nflTeamAssets';

/** Line-history row from nfl_betting_lines (only the columns the charts read). */
export interface NflLinePoint {
  as_of_ts: string;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
  home_team?: string;
  away_team?: string;
}

export interface NflLineMovementInput {
  /** Dryrun game_id (also stored as training_key on the feed row). */
  gameId?: string | null;
  homeAb?: string | null;
  awayAb?: string | null;
  season?: number | null;
  week?: number | null;
  /** Open/close from nfl_dryrun_games — used when history is sparse or empty. */
  homeSpreadOpen?: number | null;
  homeSpreadClose?: number | null;
  totalOpen?: number | null;
  totalClose?: number | null;
}

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Synthesize a 2-point open→close series from the dryrun game row. */
function openCloseSeries(input: NflLineMovementInput): NflLinePoint[] {
  const openSpread = toNum(input.homeSpreadOpen);
  const closeSpread = toNum(input.homeSpreadClose);
  const openTotal = toNum(input.totalOpen);
  const closeTotal = toNum(input.totalClose);
  if (openSpread === null && closeSpread === null && openTotal === null && closeTotal === null) {
    return [];
  }

  const openHome = openSpread ?? closeSpread;
  const closeHome = closeSpread ?? openSpread;
  const openOu = openTotal ?? closeTotal;
  const closeOu = closeTotal ?? openTotal;

  return [
    {
      as_of_ts: 'open',
      home_spread: openHome,
      away_spread: openHome !== null ? -openHome : null,
      over_line: openOu,
    },
    {
      as_of_ts: 'close',
      home_spread: closeHome,
      away_spread: closeHome !== null ? -closeHome : null,
      over_line: closeOu,
    },
  ];
}

/**
 * Full line history for one NFL game.
 *
 * Dryrun games use nflverse `game_id` (`2026_01_SEA_NE`), but `nfl_betting_lines`
 * still keys snapshots as `{homeCity}{awayCity}{season}{week}` (e.g.
 * `SeattleNew England20261`). We try the legacy key first, then fall back to the
 * dryrun open→close scalars so the widget is never blank when lines exist on the
 * game row.
 */
export function useNflLineMovement(input: NflLineMovementInput | string | undefined) {
  const normalized: NflLineMovementInput =
    typeof input === 'string' ? { gameId: input } : input || {};

  const [lineData, setLineData] = useState<NflLinePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const legacyKey =
    normalized.homeAb &&
    normalized.awayAb &&
    normalized.season &&
    normalized.week
      ? buildNflBettingLinesKey(
          normalized.homeAb,
          normalized.awayAb,
          Number(normalized.season),
          Number(normalized.week),
        )
      : null;

  useEffect(() => {
    const hasIdentity = Boolean(normalized.gameId || legacyKey);
    const hasOpenClose =
      normalized.homeSpreadOpen != null ||
      normalized.homeSpreadClose != null ||
      normalized.totalOpen != null ||
      normalized.totalClose != null;
    if (!hasIdentity && !hasOpenClose) return;

    let cancelled = false;

    const fetchLineData = async () => {
      setLoading(true);
      setError(null);
      setLineData([]);

      try {
        let rows: NflLinePoint[] = [];

        // Prefer the legacy VSiN training_key — that's what nfl_betting_lines still writes.
        const keysToTry = [legacyKey, normalized.gameId].filter(
          (k, i, arr): k is string => Boolean(k) && arr.indexOf(k) === i,
        );

        for (const key of keysToTry) {
          const { data, error: fetchError } = await collegeFootballSupabase
            .from('nfl_betting_lines')
            .select('as_of_ts, home_spread, away_spread, over_line, home_team, away_team')
            .eq('training_key', key)
            .order('as_of_ts', { ascending: true });

          if (cancelled) return;

          if (fetchError) {
            debug.error('Error fetching line movement data:', fetchError);
            continue;
          }

          if (data && data.length > 0) {
            rows = data as NflLinePoint[];
            break;
          }
        }

        // Sparse preseason history (often a single snapshot) — prefer open→close
        // from the dryrun row when it actually moved, otherwise keep history.
        const synthetic = openCloseSeries(normalized);
        if (rows.length === 0 && synthetic.length > 0) {
          rows = synthetic;
        } else if (rows.length <= 1 && synthetic.length === 2) {
          const openS = toNum(normalized.homeSpreadOpen);
          const closeS = toNum(normalized.homeSpreadClose);
          const openT = toNum(normalized.totalOpen);
          const closeT = toNum(normalized.totalClose);
          const moved =
            (openS !== null && closeS !== null && openS !== closeS) ||
            (openT !== null && closeT !== null && openT !== closeT);
          if (moved) rows = synthetic;
        }

        if (cancelled) return;

        if (rows.length === 0) {
          setError('No line movement data available');
          return;
        }

        setLineData(rows);
      } catch (err) {
        debug.error('Error fetching line data:', err);
        if (!cancelled) setError('An unexpected error occurred');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLineData();
    return () => {
      cancelled = true;
    };
    // Intentionally key off the identity fields, not the whole object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    normalized.gameId,
    legacyKey,
    normalized.homeSpreadOpen,
    normalized.homeSpreadClose,
    normalized.totalOpen,
    normalized.totalClose,
  ]);

  return { lineData, loading, error };
}
