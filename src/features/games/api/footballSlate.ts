import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';

/**
 * Shared (season, week) resolvers for the NFL/CFB `*_slate_*` tables.
 * See `.claude/docs/agents/23_NFL_CFB_2026_DATA_MAP.md`.
 *
 * - Games feed: soonest upcoming kickoff with a 6h grace (rolls Week N → N+1).
 * - Everything else: latest season desc, week desc (pipeline writes current week only).
 */

export interface FootballSlateAnchor {
  season: number;
  week: number;
}

export type FootballSlateSport = 'nfl' | 'cfb';

/**
 * Pipeline "blanket" keys — fire on nearly every game as model lean / week
 * scaffolding. Never render as per-game signal chips or include in feed BET/signal counts.
 */
export const NFL_BLANKET_SIGNAL_KEYS = new Set(['sides_model']);
export const CFB_BLANKET_SIGNAL_KEYS = new Set([
  'model_lean',
  'opener_under',
  'rivalry_week_over',
]);

export function isBlanketSignalKey(sport: FootballSlateSport, key: string): boolean {
  const normalized = key.trim();
  if (!normalized) return true;
  return sport === 'nfl'
    ? NFL_BLANKET_SIGNAL_KEYS.has(normalized)
    : CFB_BLANKET_SIGNAL_KEYS.has(normalized);
}

/** Normalize `signal_keys` from slate picks (array, JSON string, or CSV). */
export function normalizeSignalKeys(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      /* CSV fallback */
    }
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

/** Displayable chip keys from a pick's `signal_keys` (blankets stripped). */
export function displaySignalKeysFromPick(
  sport: FootballSlateSport,
  value: unknown,
): string[] {
  return Array.from(
    new Set(normalizeSignalKeys(value).filter((key) => !isBlanketSignalKey(sport, key))),
  );
}

/**
 * Feed-card signal count from the slate row.
 * NFL: `flags_active` + `flags_tracking`; CFB: `n_flags_active` + `n_flags_tracking`.
 * These columns already exclude blanket scaffolding (matches `*_slate_flags`).
 */
export function signalCountFromSlateGame(
  sport: FootballSlateSport,
  row: {
    flags_active?: number | null;
    flags_tracking?: number | null;
    n_flags_active?: number | null;
    n_flags_tracking?: number | null;
  },
): number {
  if (sport === 'nfl') {
    return (Number(row.flags_active) || 0) + (Number(row.flags_tracking) || 0);
  }
  return (Number(row.n_flags_active) || 0) + (Number(row.n_flags_tracking) || 0);
}

/**
 * Fallback unique non-blanket key count from picks.`signal_keys` only.
 * Do NOT union NFL `signals[].key` — that column includes blanket `sides_model`
 * on nearly every spread card.
 */
export async function fetchSlateSignalCounts(
  table: 'nfl_slate_picks' | 'cfb_slate_picks',
  season: number,
  week: number,
): Promise<Map<string, number>> {
  const sport: FootballSlateSport = table.startsWith('nfl') ? 'nfl' : 'cfb';
  const { data, error } = await collegeFootballSupabase
    .from(table)
    .select('game_id,signal_keys')
    .eq('season', season)
    .eq('week', week);

  const counts = new Map<string, number>();
  if (error) {
    debug.warn(`[games] ${table} signal counts:`, error.message);
    return counts;
  }

  const keysByGame = new Map<string, Set<string>>();
  for (const row of data || []) {
    const gameId = String((row as { game_id?: unknown }).game_id ?? '');
    if (!gameId) continue;
    let set = keysByGame.get(gameId);
    if (!set) {
      set = new Set();
      keysByGame.set(gameId, set);
    }
    for (const key of displaySignalKeysFromPick(
      sport,
      (row as { signal_keys?: unknown }).signal_keys,
    )) {
      set.add(key);
    }
  }
  for (const [gameId, set] of keysByGame) {
    counts.set(gameId, set.size);
  }
  return counts;
}

const FALLBACK: FootballSlateAnchor = { season: 2026, week: 1 };

async function resolveUpcomingWeek(table: 'nfl_slate_feed' | 'cfb_slate_feed'): Promise<FootballSlateAnchor> {
  const grace = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: upcoming } = await collegeFootballSupabase
    .from(table)
    .select('season, week, kickoff')
    .gte('kickoff', grace)
    .order('kickoff', { ascending: true })
    .limit(1);
  if (upcoming?.length) {
    return { season: Number(upcoming[0].season), week: Number(upcoming[0].week) };
  }
  return resolveLatestSlate(table);
}

export async function resolveLatestSlate(
  table: 'nfl_slate_feed' | 'cfb_slate_feed',
): Promise<FootballSlateAnchor> {
  const { data: latest } = await collegeFootballSupabase
    .from(table)
    .select('season, week')
    .order('season', { ascending: false })
    .order('week', { ascending: false })
    .limit(1);
  if (latest?.length) {
    return { season: Number(latest[0].season), week: Number(latest[0].week) };
  }
  return FALLBACK;
}

/** Games-feed pattern — soonest upcoming with 6h grace. */
export function resolveNflCurrentWeek(): Promise<FootballSlateAnchor> {
  return resolveUpcomingWeek('nfl_slate_feed');
}

/** Games-feed pattern — soonest upcoming with 6h grace. */
export function resolveCfbCurrentWeek(): Promise<FootballSlateAnchor> {
  return resolveUpcomingWeek('cfb_slate_feed');
}
