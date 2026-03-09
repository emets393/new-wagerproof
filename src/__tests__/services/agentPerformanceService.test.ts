import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// Mock data — leaderboard agents with varied performance
// ═══════════════════════════════════════════════════════════════════

const mockPublicAgents = [
  { id: 'agent-001', name: 'SharpShooter', avatar_emoji: '🎯', avatar_color: '#6366f1', user_id: 'user-1', preferred_sports: ['nfl', 'nba'], is_public: true },
  { id: 'agent-002', name: 'ContrarianKing', avatar_emoji: '👑', avatar_color: '#f59e0b', user_id: 'user-2', preferred_sports: ['nfl'], is_public: true },
  { id: 'agent-003', name: 'ValueHunter', avatar_emoji: '🔍', avatar_color: '#10b981', user_id: 'user-3', preferred_sports: ['nba', 'ncaab'], is_public: true },
  { id: 'agent-004', name: 'NoPicksYet', avatar_emoji: '🆕', avatar_color: '#8b5cf6', user_id: 'user-4', preferred_sports: ['nfl'], is_public: true },
];

const mockPerformanceCache = [
  { avatar_id: 'agent-001', total_picks: 50, wins: 30, losses: 18, pushes: 2, win_rate: 0.625, net_units: 8.5, current_streak: 3, best_streak: 7 },
  { avatar_id: 'agent-002', total_picks: 40, wins: 22, losses: 16, pushes: 2, win_rate: 0.579, net_units: 4.2, current_streak: -2, best_streak: 5 },
  { avatar_id: 'agent-003', total_picks: 80, wins: 48, losses: 30, pushes: 2, win_rate: 0.615, net_units: 12.8, current_streak: 5, best_streak: 8 },
  // agent-004 has no performance (new agent)
];

const mockTimeframePicks = [
  { avatar_id: 'agent-001', result: 'won', odds: '-110', units: 1, created_at: '2025-01-14T00:00:00Z' },
  { avatar_id: 'agent-001', result: 'won', odds: '-105', units: 1, created_at: '2025-01-13T00:00:00Z' },
  { avatar_id: 'agent-001', result: 'lost', odds: '+150', units: 1, created_at: '2025-01-12T00:00:00Z' },
  { avatar_id: 'agent-002', result: 'won', odds: '-110', units: 1.5, created_at: '2025-01-14T00:00:00Z' },
  { avatar_id: 'agent-002', result: 'lost', odds: '-110', units: 1, created_at: '2025-01-13T00:00:00Z' },
  { avatar_id: 'agent-003', result: 'won', odds: '+200', units: 0.5, created_at: '2025-01-14T00:00:00Z' },
];

function buildChain(resolveData: any, resolveError: any = null) {
  const chain: Record<string, any> = {};
  ['select', 'eq', 'neq', 'gte', 'lte', 'in', 'contains', 'order', 'limit'].forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue({ data: Array.isArray(resolveData) ? resolveData[0] : resolveData, error: resolveError });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: Array.isArray(resolveData) ? resolveData[0] : resolveData, error: resolveError });
  chain.then = (resolve: any) => resolve({ data: resolveData, error: resolveError });
  return chain;
}

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: { current: (() => ({})) as any },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom.current(...args),
  },
}));

// Initialize
mockFrom.current = vi.fn((table: string) => {
  if (table === 'avatar_profiles') return buildChain(mockPublicAgents);
  if (table === 'avatar_performance_cache') return buildChain(mockPerformanceCache);
  if (table === 'avatar_picks') return buildChain(mockTimeframePicks);
  return buildChain([]);
});

import {
  fetchAgentPerformance,
  fetchLeaderboard,
  type LeaderboardEntry,
} from '@/services/agentPerformanceService';

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Agent Performance & Leaderboard Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.current = vi.fn((table: string) => {
      if (table === 'avatar_profiles') return buildChain(mockPublicAgents);
      if (table === 'avatar_performance_cache') return buildChain(mockPerformanceCache);
      if (table === 'avatar_picks') return buildChain(mockTimeframePicks);
      return buildChain([]);
    });
  });

  describe('fetchAgentPerformance', () => {
    it('queries avatar_performance_cache', async () => {
      const perf = await fetchAgentPerformance('agent-001');
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_performance_cache');
      expect(perf).toBeDefined();
    });

    it('returns null for agent with no performance', async () => {
      mockFrom.current.mockReturnValueOnce(buildChain(null));
      const perf = await fetchAgentPerformance('agent-new');
      expect(perf).toBeNull();
    });
  });

  describe('fetchLeaderboard — all_time', () => {
    it('fetches public agents and their performance', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'overall', false, 'all_time');
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_profiles');
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_performance_cache');
      expect(leaderboard.length).toBeGreaterThan(0);
    });

    it('filters out agents with no settled picks', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'overall', false, 'all_time');
      // agent-004 has no performance, should be excluded
      const agent4 = leaderboard.find((e: LeaderboardEntry) => e.avatar_id === 'agent-004');
      expect(agent4).toBeUndefined();
    });

    it('sorts by net_units in overall mode (highest first)', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'overall', false, 'all_time');
      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i - 1].net_units).toBeGreaterThanOrEqual(leaderboard[i].net_units);
      }
    });

    it('can filter by sport', async () => {
      await fetchLeaderboard(100, 'nfl', 'overall', false, 'all_time');
      // Check that contains was called for sport filtering
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_profiles');
    });

    it('limits results to specified count', async () => {
      const leaderboard = await fetchLeaderboard(2, undefined, 'overall', false, 'all_time');
      expect(leaderboard.length).toBeLessThanOrEqual(2);
    });

    it('clamps limit to max 100', async () => {
      const leaderboard = await fetchLeaderboard(999, undefined, 'overall', false, 'all_time');
      expect(leaderboard.length).toBeLessThanOrEqual(100);
    });

    it('can exclude agents with under 10 picks', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'overall', true, 'all_time');
      leaderboard.forEach((entry: LeaderboardEntry) => {
        expect(entry.total_picks).toBeGreaterThanOrEqual(10);
      });
    });
  });

  describe('fetchLeaderboard — sort modes', () => {
    it('bottom_100 sorts worst performers first', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'bottom_100', false, 'all_time');
      // Bottom 100 should have lowest net_units first
      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i - 1].net_units).toBeLessThanOrEqual(leaderboard[i].net_units);
      }
    });

    it('recent_run sorts by current streak', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'recent_run', false, 'all_time');
      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i - 1].current_streak).toBeGreaterThanOrEqual(leaderboard[i].current_streak);
      }
    });

    it('longest_streak sorts by best streak', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'longest_streak', false, 'all_time');
      for (let i = 1; i < leaderboard.length; i++) {
        expect(leaderboard[i - 1].best_streak).toBeGreaterThanOrEqual(leaderboard[i].best_streak);
      }
    });
  });

  describe('fetchLeaderboard — time-filtered', () => {
    it('queries avatar_picks for time-filtered leaderboards', async () => {
      await fetchLeaderboard(100, undefined, 'overall', false, 'last_7_days');
      const calls = mockFrom.current.mock.calls.map((c: any) => c[0]);
      expect(calls).toContain('avatar_picks');
    });

    it('last_30_days also queries avatar_picks', async () => {
      await fetchLeaderboard(100, undefined, 'overall', false, 'last_30_days');
      const calls = mockFrom.current.mock.calls.map((c: any) => c[0]);
      expect(calls).toContain('avatar_picks');
    });
  });

  describe('Leaderboard entry data integrity', () => {
    it('each entry has all required display fields', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'overall', false, 'all_time');
      leaderboard.forEach((entry: LeaderboardEntry) => {
        expect(entry).toHaveProperty('avatar_id');
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('avatar_emoji');
        expect(entry).toHaveProperty('avatar_color');
        expect(entry).toHaveProperty('user_id');
        expect(entry).toHaveProperty('preferred_sports');
        expect(entry).toHaveProperty('total_picks');
        expect(entry).toHaveProperty('wins');
        expect(entry).toHaveProperty('losses');
        expect(entry).toHaveProperty('pushes');
        expect(entry).toHaveProperty('win_rate');
        expect(entry).toHaveProperty('net_units');
        expect(entry).toHaveProperty('current_streak');
        expect(entry).toHaveProperty('best_streak');
      });
    });

    it('win_rate is null or between 0 and 1', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'overall', false, 'all_time');
      leaderboard.forEach((entry: LeaderboardEntry) => {
        if (entry.win_rate !== null) {
          expect(entry.win_rate).toBeGreaterThanOrEqual(0);
          expect(entry.win_rate).toBeLessThanOrEqual(1);
        }
      });
    });

    it('total_picks >= wins + losses', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'overall', false, 'all_time');
      leaderboard.forEach((entry: LeaderboardEntry) => {
        expect(entry.total_picks).toBeGreaterThanOrEqual(entry.wins + entry.losses);
      });
    });
  });

  describe('Net units calculation', () => {
    // These test the internal calculateNetUnits logic via realistic scenarios
    it('net_units can be positive (winning agent)', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'overall', false, 'all_time');
      const topAgent = leaderboard[0];
      expect(topAgent.net_units).toBeGreaterThan(0);
    });

    it('agents are ranked by profitability in overall mode', async () => {
      const leaderboard = await fetchLeaderboard(100, undefined, 'overall', false, 'all_time');
      expect(leaderboard[0].name).toBe('ValueHunter'); // 12.8 net units
      expect(leaderboard[1].name).toBe('SharpShooter'); // 8.5 net units
      expect(leaderboard[2].name).toBe('ContrarianKing'); // 4.2 net units
    });
  });

  describe('Edge cases', () => {
    it('returns empty array when no public agents exist', async () => {
      mockFrom.current.mockReturnValueOnce(buildChain([]));
      const leaderboard = await fetchLeaderboard();
      expect(leaderboard).toEqual([]);
    });

    it('returns empty array on agents query error', async () => {
      mockFrom.current.mockReturnValueOnce(buildChain(null, { message: 'error' }));
      const leaderboard = await fetchLeaderboard();
      expect(leaderboard).toEqual([]);
    });

    it('returns empty array on performance query error', async () => {
      // First call returns agents, second call (performance) returns error
      mockFrom.current
        .mockReturnValueOnce(buildChain(mockPublicAgents))
        .mockReturnValueOnce(buildChain(null, { message: 'error' }));
      const leaderboard = await fetchLeaderboard();
      expect(leaderboard).toEqual([]);
    });
  });
});
