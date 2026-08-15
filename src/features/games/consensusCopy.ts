import type { GameAgentConsensus } from '@/services/agentConsensusService';

/**
 * Every sentence the Agent Consensus surfaces say — detail widget, feed strip,
 * and the Outliers tile — in one place, so the three cannot drift.
 *
 * Pure functions of values the server already resolved, following the same
 * discipline as `src/features/games/detail/headlines/` (see its README): no
 * re-deriving a side, no I/O, and nothing here may contradict the numbers the
 * component renders underneath it.
 *
 * WHY THIS EXISTS. The card used to state a statistic and leave the judging to
 * the reader — "The most-backed side is TCU -6.5: 18 of 35 agents, 51%
 * agreement" — while printing a footer, "flag needs 13", that exposed only the
 * agent-COUNT gate. `flagged` needs that gate AND >=55% agreement, so a card
 * could show 18 >= 13 with its bar visibly past the tick and still not flag,
 * contradicting itself. These formatters state a VERDICT and quote no gate.
 *
 * See .claude/docs/18_agent_consensus.md.
 */

/** What the card actually claims. */
export type ConsensusVerdict = 'consensus' | 'lean' | 'split' | 'tooFew';

/**
 * Mirrors the RPC's `p_min_share` default. Duplicated here ONLY to tell `lean`
 * from `split` — `flagged` is always the server's decision and is never
 * recomputed. If the SQL default moves, move this with it.
 */
const LEAN_SHARE = 0.55;

/** Below this a percentage is theatre: 1 of 2 is "50% agreement" and means nothing. */
const MIN_MEANINGFUL_MARKET = 3;

export function consensusVerdict(c: GameAgentConsensus): ConsensusVerdict {
  if (c.marketAgents < MIN_MEANINGFUL_MARKET) return 'tooFew';
  if (c.flagged) return 'consensus';
  return c.agreement >= LEAN_SHARE ? 'lean' : 'split';
}

/**
 * `null` when the deployed RPC predates market labelling — exactly when every
 * sentence has to drop its "betting the spread" clause rather than fall back to
 * the word "side", which implies a two-way market that may not exist (alt lines
 * and odds-suffixed selections both live in one market).
 */
function market(c: GameAgentConsensus): string | null {
  return c.marketLabel ? c.marketLabel : null;
}

/** One sentence, verdict first, quoting no threshold. */
export function consensusHeadline(c: GameAgentConsensus): string {
  const m = market(c);
  switch (consensusVerdict(c)) {
    case 'consensus':
      return m
        ? `Agents are on ${c.side} — ${c.sideAgents} of the ${c.marketAgents} betting the ${m}.`
        : `Agents are on ${c.side} — ${c.sideAgents} of ${c.marketAgents} agents.`;
    case 'lean':
      return m
        ? `Agents lean ${c.side}, but only ${c.marketAgents} bet the ${m}.`
        : `Agents lean ${c.side}, but only ${c.marketAgents} agents bet it.`;
    case 'split':
      return m
        ? `Agents are split on the ${m} — ${c.side} leads with ${c.sideAgents} of ${c.marketAgents}.`
        : `Agents are split — ${c.side} leads with ${c.sideAgents} of ${c.marketAgents} agents.`;
    case 'tooFew': {
      const noun = c.marketAgents === 1 ? 'agent' : 'agents';
      return m
        ? `Only ${c.marketAgents} ${noun} bet the ${m} on this game.`
        : `Only ${c.marketAgents} ${noun} bet this game.`;
    }
  }
}

export const VERDICT_WORD: Record<ConsensusVerdict, string> = {
  consensus: 'Consensus',
  lean: 'Lean',
  split: 'Split',
  tooFew: 'Too few',
};

/**
 * The label under the big percentage. Replaces a bare "agree", which never said
 * agree with WHOM or over which population — the denominator is the agents who
 * bet this market, not everyone who bet the game.
 */
export function sharePopulationLabel(c: GameAgentConsensus): string {
  const m = market(c);
  return m ? `of ${m} bets` : 'of agent bets';
}

export function mostBackedLabel(c: GameAgentConsensus): string {
  const m = market(c);
  return m ? `Most-backed ${m}` : 'Most backed';
}

/**
 * Feed-strip / Outliers-tile line. Carries the denominator, which the old strip
 * omitted entirely ("39 agents on OVER 7.5" asserted a share over an invisible
 * base, and the unflagged tier showed whole-game participation next to
 * winning-side faces).
 */
export function consensusLeaderLine(c: GameAgentConsensus): string {
  return `${c.sideAgents} of ${c.marketAgents} on ${c.side}`;
}

/** Agents in this market on neither the leader nor the runner-up. */
export function consensusOtherAgents(c: GameAgentConsensus): number {
  return Math.max(0, c.marketAgents - c.sideAgents - (c.runnerUpAgents ?? 0));
}

/** Legend beneath the divided bar, one entry per real group. */
export function consensusBarLegend(c: GameAgentConsensus): string[] {
  if (c.marketAgents <= 0) return [];
  if (c.sideAgents >= c.marketAgents) return [`${c.sideAgents} ${c.side}`, 'unanimous'];

  const parts = [`${c.sideAgents} ${c.side}`];
  if (c.runnerUpSide && c.runnerUpAgents && c.runnerUpAgents > 0) {
    parts.push(`${c.runnerUpAgents} ${c.runnerUpSide}`);
  }
  const other = consensusOtherAgents(c);
  if (other > 0) parts.push(`${other} other`);
  return parts;
}

/**
 * "#3 of 14 today" — turns an abstract 51% into a comparison against the board
 * the user is looking at. `null` on pre-migration rows, and on a one-game slate
 * where a rank says nothing.
 */
export function consensusSlateRankLabel(c: GameAgentConsensus): string | null {
  if (c.slateRank === null || c.slateGames === null || c.slateGames <= 1) return null;
  return `#${c.slateRank} of ${c.slateGames} today`;
}
