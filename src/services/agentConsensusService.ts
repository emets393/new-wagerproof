import { supabase } from '@/integrations/supabase/client';
import debug from '@/utils/debug';
import type { GamesSport } from '@/features/games/types';

/**
 * Agent consensus for the /games feed — "N agents on <side>" + the green Bet
 * flag. See .claude/docs/18_agent_consensus.md.
 *
 * Lives in MAIN Supabase (avatar_picks) while the games feed comes from the CFB
 * project, so there is no SQL join available: this fetches counts keyed by
 * game_id and the caller merges them into the feed by map lookup. The merge
 * MUST be a left join — picks exist before predictions populate, and a game
 * with no consensus row is normal, not an error.
 */

export interface ConsensusAvatar {
  avatarId: string;
  name: string;
  /**
   * Explicit avatar_profiles.sprite_index, or null. NULL for ~96% of agents —
   * resolve with agentSpriteIndex(avatarId, spriteIndex), never default to 0.
   */
  spriteIndex: number | null;
  /** Halo/background tint only. */
  color: string | null;
}

export interface GameAgentConsensus {
  gameId: string;
  gameDate: string;
  /** Distinct public+active agents with a pick on this game. */
  agents: number;
  /** The single most-backed selection, verbatim (e.g. "Over 7.5"). */
  side: string;
  /** Distinct agents on that side. */
  sideAgents: number;
  /** sideAgents / agents, 0-1. */
  agreement: number;
  /** Agents-on-one-side needed to flag today; scales with slate volume. */
  threshold: number;
  /** True when the side clears both the scaled count bar and the agreement bar. */
  flagged: boolean;
  /** Up to 4 agents from the winning side, for the overlap stack. */
  avatars: ConsensusAvatar[];
}

export interface ConsensusRow {
  game_id: string;
  game_date: string;
  agents: number;
  side: string;
  side_agents: number;
  /** Postgres `numeric` serializes as a STRING over PostgREST, not a number. */
  agreement: string | number | null;
  threshold: number;
  flagged: boolean;
  avatars: ConsensusAvatar[] | null;
}

/** Exported for tests — the numeric-as-string coercion is the sharp edge here. */
export function mapConsensusRow(row: ConsensusRow): GameAgentConsensus {
  return {
    gameId: String(row.game_id),
    gameDate: row.game_date,
    agents: row.agents,
    side: row.side,
    sideAgents: row.side_agents,
    agreement: Number(row.agreement ?? 0),
    threshold: row.threshold,
    flagged: Boolean(row.flagged),
    avatars: row.avatars ?? [],
  };
}

/**
 * One RPC call for a whole slate. `dates` is every distinct game date in the
 * feed — MLB's `mlb_games_today` view spans today AND tomorrow, so a
 * single-date call would leave the next day's cards permanently unflagged.
 */
export async function fetchGameAgentConsensus(
  sport: GamesSport,
  dates: string[],
): Promise<Map<string, GameAgentConsensus>> {
  const result = new Map<string, GameAgentConsensus>();
  if (dates.length === 0) return result;

  try {
    const { data, error } = await (supabase as any).rpc('get_game_agent_consensus', {
      p_sport: sport,
      p_game_dates: dates,
    });

    if (error) {
      // Non-fatal by design: the feed renders fine without the strip.
      debug.warn('fetchGameAgentConsensus: RPC failed', error.message);
      return result;
    }

    for (const row of (data ?? []) as ConsensusRow[]) {
      const mapped = mapConsensusRow(row);
      result.set(mapped.gameId, mapped);
    }
  } catch (err) {
    debug.warn('fetchGameAgentConsensus: unexpected error', err);
  }

  return result;
}
