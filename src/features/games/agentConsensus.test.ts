import { describe, it, expect } from 'vitest';
import { mapConsensusRow, type ConsensusRow } from '@/services/agentConsensusService';
import { avatarBackground } from './components/AgentConsensusStrip';

const baseRow: ConsensusRow = {
  game_id: '823354',
  game_date: '2026-07-26',
  agents: 28,
  side: 'Over 8.5',
  side_agents: 16,
  market_agents: 28,
  market_label: 'total',
  agreement: '0.5714',
  threshold: 16,
  flagged: true,
  avatars: [{ avatarId: 'a1', name: 'Eagle eye', spriteIndex: 3, color: 'gradient:#6366f1,#3b82f6' }],
};

describe('mapConsensusRow', () => {
  it('coerces the numeric agreement string PostgREST returns into a number', () => {
    const m = mapConsensusRow(baseRow);
    // Postgres `numeric` arrives as a string; a raw pass-through would make
    // `agreement * 100` produce "0.57140.5714..." via string coercion.
    expect(typeof m.agreement).toBe('number');
    expect(m.agreement).toBeCloseTo(0.5714, 4);
    expect(Math.round(m.agreement * 100)).toBe(57);
  });

  it('defaults a null agreement to 0 rather than NaN', () => {
    expect(mapConsensusRow({ ...baseRow, agreement: null }).agreement).toBe(0);
  });

  it('accepts an already-numeric agreement', () => {
    expect(mapConsensusRow({ ...baseRow, agreement: 0.88 }).agreement).toBeCloseTo(0.88);
  });

  it('normalises a null avatars array to empty so the stack never crashes', () => {
    expect(mapConsensusRow({ ...baseRow, avatars: null }).avatars).toEqual([]);
  });

  it('stringifies game_id so the map key matches the feed id', () => {
    const m = mapConsensusRow({ ...baseRow, game_id: 823354 as unknown as string });
    expect(m.gameId).toBe('823354');
  });

  it('carries the flag and side through verbatim', () => {
    const m = mapConsensusRow(baseRow);
    expect(m.flagged).toBe(true);
    expect(m.side).toBe('Over 8.5');
    expect(m.sideAgents).toBe(16);
    expect(m.threshold).toBe(16);
  });

  it('keeps the market population separate from whole-game participation', () => {
    // The Pirates case: 17 agents bet the game, only 6 bet the F5 run line, and
    // 5 of those 6 took Pittsburgh. Agreement is 5/6, not 5/17.
    const m = mapConsensusRow({
      ...baseRow,
      agents: 17,
      side: 'Pittsburgh Pirates F5 -0.5',
      side_agents: 5,
      market_agents: 6,
      market_label: 'F5 run line',
      agreement: '0.8333',
      flagged: false,
    });
    expect(m.agents).toBe(17);
    expect(m.marketAgents).toBe(6);
    expect(m.marketLabel).toBe('F5 run line');
    expect(Math.round(m.agreement * 100)).toBe(83);
  });

  it('falls back to the game population when the market columns are absent', () => {
    // A client deployed ahead of the migration must not divide by zero and show
    // an empty agreement bar.
    const { market_agents: _a, market_label: _b, ...legacy } = baseRow;
    const m = mapConsensusRow(legacy as ConsensusRow);
    expect(m.marketAgents).toBe(28);
    expect(m.marketLabel).toBe('');
  });

  it('maps the runner-up and slate rank', () => {
    const mapped = mapConsensusRow({
      ...baseRow,
      runner_up_side: 'Under 8.5',
      runner_up_agents: 10,
      slate_rank: 3,
      slate_games: 14,
    });
    expect(mapped.runnerUpSide).toBe('Under 8.5');
    expect(mapped.runnerUpAgents).toBe(10);
    expect(mapped.slateRank).toBe(3);
    expect(mapped.slateGames).toBe(14);
  });

  /**
   * Absent on a client deployed ahead of the runner-up/rank migration. They MUST
   * stay null, not 0 — `Number(null)` is 0, which would render "#0 of 0 today"
   * and a bogus "0 other" bar segment.
   */
  it('keeps the runner-up and rank null when the columns are absent', () => {
    const mapped = mapConsensusRow(baseRow);
    expect(mapped.runnerUpSide).toBeNull();
    expect(mapped.runnerUpAgents).toBeNull();
    expect(mapped.slateRank).toBeNull();
    expect(mapped.slateGames).toBeNull();
  });
});

describe('avatarBackground', () => {
  it('builds a linear-gradient from the "gradient:" form', () => {
    expect(avatarBackground('gradient:#ef4444,#ec4899')).toBe(
      'linear-gradient(135deg, #ef4444, #ec4899)'
    );
  });

  it('passes a plain hex through untouched', () => {
    expect(avatarBackground('#22c55e')).toBe('#22c55e');
  });

  it('falls back to a slate fill when color is missing', () => {
    expect(avatarBackground(null)).toBe('#64748b');
  });

  it('repeats the single stop when a gradient only declares one colour', () => {
    // Malformed rows exist in avatar_profiles; a bare "gradient:#abc" must not
    // emit `linear-gradient(135deg, #abc, undefined)`.
    expect(avatarBackground('gradient:#abcdef')).toBe(
      'linear-gradient(135deg, #abcdef, #abcdef)'
    );
  });
});
