import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';

/**
 * Shared (season, week) resolvers for the NFL/CFB `*_dryrun_*` tables.
 * See `.claude/docs/agents/23_NFL_CFB_2026_DATA_MAP.md`.
 *
 * - Games feed: soonest upcoming kickoff with a 6h grace (rolls Week N → N+1).
 * - Everything else: latest season desc, week desc (pipeline writes current week only).
 */

export interface FootballSlateAnchor {
  season: number;
  week: number;
}

const FALLBACK: FootballSlateAnchor = { season: 2026, week: 1 };

async function resolveUpcomingWeek(table: 'nfl_dryrun_games' | 'cfb_dryrun_games'): Promise<FootballSlateAnchor> {
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
  table: 'nfl_dryrun_games' | 'cfb_dryrun_games',
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
  return resolveUpcomingWeek('nfl_dryrun_games');
}

/** Games-feed pattern — soonest upcoming with 6h grace. */
export function resolveCfbCurrentWeek(): Promise<FootballSlateAnchor> {
  return resolveUpcomingWeek('cfb_dryrun_games');
}
