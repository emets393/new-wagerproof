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
  /**
   * Distinct agents who bet the same market as `side` (bet_type × period).
   * This is the agreement denominator — NOT `agents`, which pools every market.
   */
  marketAgents: number;
  /** The market `side` belongs to, for attribution (e.g. "F5 run line"). */
  marketLabel: string;
  /** sideAgents / marketAgents, 0-1. */
  agreement: number;
  /**
   * Agents-on-one-side needed to flag today; scales with slate volume.
   * Internal plumbing — never render it. It is only ONE of the two gates behind
   * `flagged`, and printing it made a card claim the bar was cleared when the
   * agreement gate was what failed.
   */
  threshold: number;
  /** True when the side clears both the scaled count bar and the agreement bar. */
  flagged: boolean;
  /**
   * The SECOND-most-backed selection in the same market as `side`, verbatim.
   * `null` when the market was unanimous, or when the deployed RPC predates the
   * runner-up migration. NOT "the other side" — `pick_selection` is
   * unnormalized, so a market can hold more than two distinct strings.
   */
  runnerUpSide: string | null;
  /** Distinct agents on `runnerUpSide`. */
  runnerUpAgents: number | null;
  /**
   * Where this game ranks on its own date by agreement (1 = strongest), flagged
   * games first. `null` on pre-migration rows.
   */
  slateRank: number | null;
  /** Games on that date with at least one agent pick — the rank's denominator. */
  slateGames: number | null;
  /** Up to 4 agents from the winning side, for the overlap stack. */
  avatars: ConsensusAvatar[];
}

export interface ConsensusRow {
  game_id: string;
  game_date: string;
  agents: number;
  side: string;
  side_agents: number;
  market_agents?: number | null;
  market_label?: string | null;
  /** Postgres `numeric` serializes as a STRING over PostgREST, not a number. */
  agreement: string | number | null;
  threshold: number;
  flagged: boolean;
  runner_up_side?: string | null;
  runner_up_agents?: number | null;
  slate_rank?: number | null;
  slate_games?: number | null;
  avatars: ConsensusAvatar[] | null;
}

/** `Number(null)` is 0, which would silently become a real rank. */
function optionalInt(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Exported for tests — the numeric-as-string coercion is the sharp edge here. */
export function mapConsensusRow(row: ConsensusRow): GameAgentConsensus {
  return {
    gameId: String(row.game_id),
    gameDate: row.game_date,
    agents: row.agents,
    side: row.side,
    sideAgents: row.side_agents,
    // Pre-migration rows have no market columns; falling back to the whole-game
    // count reproduces the old (over-pooled) denominator rather than dividing by
    // zero and rendering an empty bar.
    marketAgents: Number(row.market_agents ?? row.agents ?? 0),
    marketLabel: row.market_label ?? '',
    agreement: Number(row.agreement ?? 0),
    threshold: row.threshold,
    flagged: Boolean(row.flagged),
    // Absent on a client deployed ahead of the runner-up/rank migration: the
    // card drops its second bar segment and its rank line rather than inventing
    // a "0 other" group or a "#0 of 0 today" footer.
    runnerUpSide: row.runner_up_side ?? null,
    runnerUpAgents: optionalInt(row.runner_up_agents),
    slateRank: optionalInt(row.slate_rank),
    slateGames: optionalInt(row.slate_games),
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
