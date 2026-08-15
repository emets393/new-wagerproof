import { describe, expect, it } from 'vitest';
import {
  consensusBarLegend,
  consensusHeadline,
  consensusLeaderLine,
  consensusOtherAgents,
  consensusSlateRankLabel,
  consensusVerdict,
  mostBackedLabel,
  sharePopulationLabel,
} from './consensusCopy';
import type { GameAgentConsensus } from '@/services/agentConsensusService';

/**
 * These are the sentences the user reads. The failure this file guards is a
 * card that recites a statistic instead of reaching a conclusion — "the
 * most-backed side is TCU -6.5, 51% agreement" on what is a coin flip — or one
 * that leaks the flag threshold and implies a gate was cleared when the other
 * gate is what failed.
 */

function row(over: Partial<GameAgentConsensus> = {}): GameAgentConsensus {
  const sideAgents = over.sideAgents ?? 18;
  const marketAgents = over.marketAgents ?? 35;
  return {
    gameId: 'g',
    gameDate: '2026-08-15',
    agents: marketAgents,
    side: 'TCU -6.5',
    sideAgents,
    marketAgents,
    marketLabel: 'spread',
    agreement: sideAgents / marketAgents,
    threshold: 13,
    flagged: false,
    runnerUpSide: null,
    runnerUpAgents: null,
    slateRank: null,
    slateGames: null,
    avatars: [],
    ...over,
  };
}

describe('consensusVerdict', () => {
  it('names each state', () => {
    expect(consensusVerdict(row({ sideAgents: 31, marketAgents: 35, flagged: true }))).toBe('consensus');
    // 51% and unflagged — the case that used to read as a lean.
    expect(consensusVerdict(row({ sideAgents: 18, marketAgents: 35 }))).toBe('split');
    // Lopsided but too thin to clear the count gate.
    expect(consensusVerdict(row({ sideAgents: 5, marketAgents: 6 }))).toBe('lean');
    expect(consensusVerdict(row({ sideAgents: 1, marketAgents: 2 }))).toBe('tooFew');
  });

  it('lets the server flag win over the local share constant', () => {
    expect(consensusVerdict(row({ sideAgents: 9, marketAgents: 20, flagged: true }))).toBe('consensus');
  });
});

describe('consensusHeadline', () => {
  it('states a verdict first', () => {
    expect(
      consensusHeadline(
        row({ side: 'Over 7.5', sideAgents: 31, marketAgents: 35, marketLabel: 'total', flagged: true })
      )
    ).toBe('Agents are on Over 7.5 — 31 of the 35 betting the total.');

    expect(consensusHeadline(row({ sideAgents: 18, marketAgents: 35 }))).toBe(
      'Agents are split on the spread — TCU -6.5 leads with 18 of 35.'
    );

    expect(
      consensusHeadline(
        row({ side: 'Pirates F5 -0.5', sideAgents: 5, marketAgents: 6, marketLabel: 'F5 run line' })
      )
    ).toBe('Agents lean Pirates F5 -0.5, but only 6 bet the F5 run line.');

    expect(consensusHeadline(row({ sideAgents: 1, marketAgents: 1 }))).toBe(
      'Only 1 agent bet the spread on this game.'
    );
  });

  it('never leaks the flag threshold', () => {
    for (const c of [row({ sideAgents: 18 }), row({ sideAgents: 31, flagged: true })]) {
      const text = consensusHeadline(c);
      expect(text).not.toContain('13');
      expect(text.toLowerCase()).not.toContain('flag');
      expect(text).not.toContain('55');
    }
  });

  /**
   * A pre-migration row has no market label, and the copy must not fall back to
   * "side" — a market holding alt lines or odds-suffixed selections is not
   * necessarily two-way.
   */
  it('drops the market clause when the label is missing', () => {
    const legacy = row({ marketLabel: '' });
    expect(consensusHeadline(legacy)).toBe('Agents are split — TCU -6.5 leads with 18 of 35 agents.');
    expect(consensusHeadline(legacy)).not.toContain('side');
    expect(mostBackedLabel(legacy)).toBe('Most backed');
    expect(sharePopulationLabel(legacy)).toBe('of agent bets');
  });

  it('names the population the percentage is over', () => {
    expect(sharePopulationLabel(row({ marketLabel: 'F5 run line' }))).toBe('of F5 run line bets');
    expect(mostBackedLabel(row())).toBe('Most-backed spread');
  });
});

describe('consensusBarLegend', () => {
  it('names every segment', () => {
    expect(
      consensusBarLegend(row({ runnerUpSide: 'Baylor +6.5', runnerUpAgents: 15 }))
    ).toEqual(['18 TCU -6.5', '15 Baylor +6.5', '2 other']);
  });

  it('omits the third group when two sides account for the market', () => {
    expect(
      consensusBarLegend(row({ sideAgents: 20, runnerUpSide: 'Baylor +6.5', runnerUpAgents: 15 }))
    ).toEqual(['20 TCU -6.5', '15 Baylor +6.5']);
  });

  it('says unanimous rather than drawing an empty remainder', () => {
    expect(consensusBarLegend(row({ sideAgents: 12, marketAgents: 12, flagged: true }))).toEqual([
      '12 TCU -6.5',
      'unanimous',
    ]);
  });

  /** Pre-migration rows have no runner-up; everything else is simply "other". */
  it('folds the unknown remainder into other', () => {
    expect(consensusOtherAgents(row())).toBe(17);
    expect(consensusBarLegend(row())).toEqual(['18 TCU -6.5', '17 other']);
  });
});

describe('consensusSlateRankLabel', () => {
  it('compares the game against its own board', () => {
    expect(consensusSlateRankLabel(row({ slateRank: 3, slateGames: 14 }))).toBe('#3 of 14 today');
  });

  it('is absent on pre-migration rows and one-game slates', () => {
    expect(consensusSlateRankLabel(row())).toBeNull();
    expect(consensusSlateRankLabel(row({ slateRank: 1, slateGames: 1 }))).toBeNull();
  });
});

/** The old flagged strip asserted a share with no visible denominator. */
describe('consensusLeaderLine', () => {
  it('carries the denominator', () => {
    expect(consensusLeaderLine(row())).toBe('18 of 35 on TCU -6.5');
  });
});
