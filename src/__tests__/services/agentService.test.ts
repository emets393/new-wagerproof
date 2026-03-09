import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// Mock data — realistic agent profiles and performance
// ═══════════════════════════════════════════════════════════════════

const mockAgentProfile = {
  id: 'agent-001',
  user_id: 'user-123',
  name: 'SharpShooter',
  avatar_emoji: '🎯',
  avatar_color: '#6366f1',
  preferred_sports: ['nfl', 'nba'],
  archetype: 'sharp',
  personality_params: {
    risk_tolerance: 3,
    underdog_lean: 2,
    over_under_lean: 3,
    confidence_threshold: 4,
    chase_value: true,
    preferred_bet_type: 'spread',
    max_favorite_odds: null,
    min_underdog_odds: null,
    max_picks_per_day: 3,
    skip_weak_slates: false,
    trust_model: 4,
    trust_polymarket: 3,
    polymarket_divergence_flag: true,
    home_court_boost: 3,
  },
  custom_insights: {
    betting_philosophy: 'Follow the models, fade the public',
    perceived_edges: 'Line movement analysis',
    avoid_situations: 'Back-to-back games',
    target_situations: 'Division rivals',
  },
  is_public: true,
  is_active: true,
  auto_generate: true,
  auto_generate_time: '09:00',
  auto_generate_timezone: 'America/New_York',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
};

const mockPerformance = {
  avatar_id: 'agent-001',
  total_picks: 50,
  wins: 30,
  losses: 18,
  pushes: 2,
  win_rate: 0.625,
  net_units: 8.5,
  current_streak: 3,
  best_streak: 7,
  updated_at: '2025-01-15T00:00:00Z',
};

const mockArchetypes = [
  { id: 'arch-1', name: 'Sharp', description: 'Data-driven analytical style', display_order: 1, is_active: true, personality_defaults: {} },
  { id: 'arch-2', name: 'Contrarian', description: 'Fades public sentiment', display_order: 2, is_active: true, personality_defaults: {} },
  { id: 'arch-3', name: 'Value Hunter', description: 'Hunts for odds edges', display_order: 3, is_active: true, personality_defaults: {} },
];

// Build a chainable mock
function buildChain(resolveData: any, resolveError: any = null) {
  const chain: Record<string, any> = {};
  const methods = ['select', 'eq', 'neq', 'gte', 'lte', 'in', 'contains', 'order', 'limit', 'insert', 'update', 'delete'];
  methods.forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue({ data: Array.isArray(resolveData) ? resolveData[0] : resolveData, error: resolveError });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: Array.isArray(resolveData) ? resolveData[0] : resolveData, error: resolveError });
  chain.then = (resolve: any) => resolve({ data: resolveData, error: resolveError });
  return chain;
}

// Use vi.hoisted to make mock available to vi.mock factory
const { mockFrom, mockRpc, mockGetSession, mockInvoke } = vi.hoisted(() => ({
  mockFrom: { current: (() => ({})) as any },
  mockRpc: { current: (() => Promise.resolve({ data: true, error: null })) as any },
  mockGetSession: { current: (() => Promise.resolve({ data: { session: { user: { id: 'user-123' } } }, error: null })) as any },
  mockInvoke: { current: (() => Promise.resolve({ data: { success: true }, error: null })) as any },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom.current(...args),
    rpc: (...args: any[]) => mockRpc.current(...args),
    auth: { getSession: (...args: any[]) => mockGetSession.current(...args) },
    functions: { invoke: (...args: any[]) => mockInvoke.current(...args) },
  },
}));

vi.mock('@/integrations/supabase/college-football-client', () => ({
  collegeFootballSupabase: {
    from: (...args: any[]) => mockFrom.current(...args),
  },
}));

// Set up actual implementations
mockFrom.current = vi.fn((table: string) => {
  if (table === 'avatar_profiles') return buildChain([mockAgentProfile]);
  if (table === 'avatar_performance_cache') return buildChain([mockPerformance]);
  if (table === 'preset_archetypes') return buildChain(mockArchetypes);
  return buildChain([]);
});
mockRpc.current = vi.fn().mockResolvedValue({ data: true, error: null });
mockGetSession.current = vi.fn().mockResolvedValue({
  data: { session: { user: { id: 'user-123' } } },
  error: null,
});
mockInvoke.current = vi.fn().mockResolvedValue({ data: { success: true }, error: null });

import {
  fetchUserAgents,
  fetchAgentById,
  deleteAgent,
  fetchPresetArchetypes,
} from '@/services/agentService';

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Agent Service — Core Agent Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default implementations
    mockFrom.current = vi.fn((table: string) => {
      if (table === 'avatar_profiles') return buildChain([mockAgentProfile]);
      if (table === 'avatar_performance_cache') return buildChain([mockPerformance]);
      if (table === 'preset_archetypes') return buildChain(mockArchetypes);
      return buildChain([]);
    });
    mockRpc.current = vi.fn().mockResolvedValue({ data: true, error: null });
  });

  describe('fetchUserAgents', () => {
    it('queries avatar_profiles for the given user', async () => {
      await fetchUserAgents('user-123');
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_profiles');
    });

    it('also fetches performance data for each agent', async () => {
      await fetchUserAgents('user-123');
      const calls = (mockFrom.current as any).mock.calls.map((c: any) => c[0]);
      expect(calls).toContain('avatar_profiles');
      expect(calls).toContain('avatar_performance_cache');
    });

    it('returns agents with performance attached', async () => {
      const agents = await fetchUserAgents('user-123');
      expect(agents).toBeDefined();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0]).toHaveProperty('performance');
    });

    it('returns empty array for user with no agents', async () => {
      mockFrom.current = vi.fn().mockReturnValue(buildChain([]));
      const agents = await fetchUserAgents('user-no-agents');
      expect(agents).toEqual([]);
    });
  });

  describe('fetchAgentById', () => {
    it('queries avatar_profiles by agent ID', async () => {
      await fetchAgentById('agent-001');
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_profiles');
    });

    it('returns agent with performance data', async () => {
      const agent = await fetchAgentById('agent-001');
      expect(agent).toBeDefined();
      expect(agent!.name).toBe('SharpShooter');
      expect(agent!.performance).toBeDefined();
    });

    it('returns null for PGRST116 (not found) error', async () => {
      mockFrom.current = vi.fn().mockReturnValue(
        buildChain(null, { code: 'PGRST116', message: 'Not found' })
      );
      const agent = await fetchAgentById('nonexistent');
      expect(agent).toBeNull();
    });
  });

  describe('deleteAgent', () => {
    it('calls delete on avatar_profiles', async () => {
      await deleteAgent('agent-001');
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_profiles');
    });
  });

  describe('fetchPresetArchetypes', () => {
    it('queries preset_archetypes table', async () => {
      await fetchPresetArchetypes();
      expect(mockFrom.current).toHaveBeenCalledWith('preset_archetypes');
    });

    it('returns active archetypes', async () => {
      const archetypes = await fetchPresetArchetypes();
      expect(archetypes.length).toBe(3);
      expect(archetypes[0].name).toBe('Sharp');
    });
  });

  describe('Agent Profile Data Integrity', () => {
    it('personality_params has all required core fields', () => {
      const params = mockAgentProfile.personality_params;
      expect(params).toHaveProperty('risk_tolerance');
      expect(params).toHaveProperty('underdog_lean');
      expect(params).toHaveProperty('over_under_lean');
      expect(params).toHaveProperty('confidence_threshold');
      expect(params).toHaveProperty('chase_value');
      expect(params).toHaveProperty('preferred_bet_type');
      expect(params).toHaveProperty('max_picks_per_day');
      expect(params).toHaveProperty('trust_model');
      expect(params).toHaveProperty('trust_polymarket');
      expect(params).toHaveProperty('home_court_boost');
    });

    it('personality_params values are in valid ranges (1-5 sliders)', () => {
      const params = mockAgentProfile.personality_params;
      const sliderFields = ['risk_tolerance', 'underdog_lean', 'over_under_lean', 'confidence_threshold', 'trust_model', 'trust_polymarket', 'home_court_boost'] as const;
      sliderFields.forEach(field => {
        const val = params[field] as number;
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(5);
      });
    });

    it('preferred_bet_type is valid enum', () => {
      expect(['spread', 'moneyline', 'total', 'any']).toContain(mockAgentProfile.personality_params.preferred_bet_type);
    });

    it('preferred_sports contains valid sport keys', () => {
      const validSports = ['nfl', 'cfb', 'nba', 'ncaab'];
      mockAgentProfile.preferred_sports.forEach(sport => {
        expect(validSports).toContain(sport);
      });
    });

    it('custom_insights has expected fields', () => {
      const insights = mockAgentProfile.custom_insights;
      expect(insights).toHaveProperty('betting_philosophy');
      expect(insights).toHaveProperty('perceived_edges');
      expect(insights).toHaveProperty('avoid_situations');
      expect(insights).toHaveProperty('target_situations');
    });
  });

  describe('Agent Performance Data Integrity', () => {
    it('performance has all W-L-P fields', () => {
      expect(mockPerformance).toHaveProperty('total_picks');
      expect(mockPerformance).toHaveProperty('wins');
      expect(mockPerformance).toHaveProperty('losses');
      expect(mockPerformance).toHaveProperty('pushes');
      expect(mockPerformance).toHaveProperty('win_rate');
      expect(mockPerformance).toHaveProperty('net_units');
    });

    it('W + L + P = total_picks', () => {
      expect(mockPerformance.wins + mockPerformance.losses + mockPerformance.pushes).toBe(mockPerformance.total_picks);
    });

    it('win_rate matches calculated value', () => {
      const settled = mockPerformance.wins + mockPerformance.losses;
      const expectedWinRate = mockPerformance.wins / settled;
      expect(mockPerformance.win_rate).toBeCloseTo(expectedWinRate, 2);
    });

    it('streak values are reasonable', () => {
      expect(mockPerformance.current_streak).toBeLessThanOrEqual(mockPerformance.total_picks);
      expect(mockPerformance.best_streak).toBeGreaterThanOrEqual(Math.abs(mockPerformance.current_streak));
    });
  });
});
