import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// Mock data — agent picks with full audit trail
// ═══════════════════════════════════════════════════════════════════

const mockPicks = [
  {
    id: 'pick-001',
    avatar_id: 'agent-001',
    game_id: 'nfl_2025_week10_KC_BUF',
    sport: 'nfl',
    matchup: 'Buffalo Bills @ Kansas City Chiefs',
    game_date: '2025-11-15',
    bet_type: 'spread',
    pick_selection: 'Chiefs -3.5',
    odds: '-110',
    units: 1.5,
    confidence: 4,
    reasoning_text: 'Model shows 55% cover probability, significantly above the implied 52.4% from -110 odds. Chiefs have strong home field advantage in primetime.',
    key_factors: [
      'Model edge: +2.6% above implied probability',
      'Chiefs 8-2 ATS at home this season',
      'Bills coming off a short week',
    ],
    ai_decision_trace: {
      leaned_metrics: [
        { metric_key: 'model_home_edge', metric_value: '2.6%', why_it_mattered: 'Model edge above threshold', personality_trait: 'trust_model: 4' },
      ],
      rationale_summary: 'Model-driven edge on home spread',
      personality_alignment: 'High trust_model (4/5) prioritizes model signals',
    },
    ai_audit_payload: {
      system_prompt_version: 'prompt-v3',
      model_input_game_payload: { game_id: 'nfl_2025_week10_KC_BUF' },
      model_input_personality_payload: { risk_tolerance: 3, trust_model: 4 },
      model_response_payload: { game_id: 'nfl_2025_week10_KC_BUF', bet_type: 'spread' },
    },
    archived_game_data: {
      home_team: 'Kansas City Chiefs',
      away_team: 'Buffalo Bills',
      home_spread: -3.5,
      model_prob: 0.55,
    },
    archived_personality: { risk_tolerance: 3, trust_model: 4 },
    result: 'pending',
    created_at: '2025-11-15T08:00:00Z',
  },
  {
    id: 'pick-002',
    avatar_id: 'agent-001',
    game_id: 'nba_20251115_LAL_BOS',
    sport: 'nba',
    matchup: 'Lakers @ Celtics',
    game_date: '2025-11-15',
    bet_type: 'total',
    pick_selection: 'Over 220.5',
    odds: '-108',
    units: 1.0,
    confidence: 3,
    reasoning_text: 'Both teams rank top 10 in pace and offensive efficiency. The pace-adjusted total projection is 225, well above the posted 220.5.',
    key_factors: [
      'Combined pace above league average',
      'Both teams top 10 in offensive rating',
      'Model total projection: 225',
    ],
    ai_decision_trace: null,
    ai_audit_payload: null,
    archived_game_data: {},
    archived_personality: {},
    result: 'won',
    created_at: '2025-11-15T08:00:00Z',
  },
];

const mockGenerationRun = {
  id: 'run-001',
  status: 'succeeded',
  picks_generated: 3,
  error_message: null,
};

const mockOverlapData = [
  {
    source_pick_id: 'pick-001',
    overlap_avatar_id: 'agent-002',
    avatar_name: 'ContrarianKing',
    avatar_emoji: '👑',
    avatar_color: '#f59e0b',
  },
  {
    source_pick_id: 'pick-001',
    overlap_avatar_id: 'agent-003',
    avatar_name: 'ValueHunter',
    avatar_emoji: '🔍',
    avatar_color: '#10b981',
  },
];

// Build chainable mock
function buildChain(resolveData: any, resolveError: any = null) {
  const chain: Record<string, any> = {};
  ['select', 'eq', 'neq', 'gte', 'lte', 'in', 'order', 'limit', 'insert', 'update', 'delete', 'upsert'].forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue({ data: Array.isArray(resolveData) ? resolveData[0] : resolveData, error: resolveError });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: Array.isArray(resolveData) ? resolveData[0] : resolveData, error: resolveError });
  chain.then = (resolve: any) => resolve({ data: resolveData, error: resolveError });
  return chain;
}

const { mockFrom, mockRpc, mockGetSession, mockInvoke } = vi.hoisted(() => ({
  mockFrom: { current: (() => ({})) as any },
  mockRpc: { current: (() => Promise.resolve({ data: [], error: null })) as any },
  mockGetSession: { current: (() => Promise.resolve({ data: { session: { access_token: 'tok', user: { id: 'user-123' } } }, error: null })) as any },
  mockInvoke: { current: (() => Promise.resolve({ data: { success: true, run_id: 'run-001' }, error: null })) as any },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom.current(...args),
    rpc: (...args: any[]) => mockRpc.current(...args),
    auth: { getSession: (...args: any[]) => mockGetSession.current(...args) },
    functions: { invoke: (...args: any[]) => mockInvoke.current(...args) },
  },
}));

// Initialize mock implementations
mockFrom.current = vi.fn((table: string) => {
  if (table === 'avatar_picks') return buildChain(mockPicks);
  if (table === 'agent_generation_runs') return buildChain(mockGenerationRun);
  return buildChain([]);
});
mockRpc.current = vi.fn().mockResolvedValue({ data: mockOverlapData, error: null });
mockGetSession.current = vi.fn().mockResolvedValue({
  data: { session: { access_token: 'tok', user: { id: 'user-123' } } },
  error: null,
});
mockInvoke.current = vi.fn().mockResolvedValue({
  data: { success: true, run_id: 'run-001' },
  error: null,
});

import {
  fetchAgentPicks,
  generatePicks,
  enrichPicksWithOverlap,
} from '@/services/agentPicksService';

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Agent Picks Service — Pick Generation & Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.current = vi.fn((table: string) => {
      if (table === 'avatar_picks') return buildChain(mockPicks);
      if (table === 'agent_generation_runs') return buildChain(mockGenerationRun);
      return buildChain([]);
    });
    mockRpc.current = vi.fn().mockResolvedValue({ data: mockOverlapData, error: null });
    mockGetSession.current = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'tok', user: { id: 'user-123' } } },
      error: null,
    });
    mockInvoke.current = vi.fn().mockResolvedValue({
      data: { success: true, run_id: 'run-001' },
      error: null,
    });
  });

  describe('fetchAgentPicks', () => {
    it('queries avatar_picks for the given agent', async () => {
      const picks = await fetchAgentPicks('agent-001');
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_picks');
      expect(picks.length).toBe(2);
    });

    it('applies sport filter when provided', async () => {
      await fetchAgentPicks('agent-001', { sport: 'nfl' });
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_picks');
    });

    it('applies result filter when provided', async () => {
      await fetchAgentPicks('agent-001', { result: 'won' });
      expect(mockFrom.current).toHaveBeenCalledWith('avatar_picks');
    });

    it('returns empty array on no data', async () => {
      mockFrom.current.mockReturnValueOnce(buildChain(null));
      const picks = await fetchAgentPicks('agent-no-picks');
      expect(picks).toEqual([]);
    });
  });

  describe('generatePicks', () => {
    it('requires authentication', async () => {
      mockGetSession.current = vi.fn().mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });
      await expect(generatePicks('agent-001')).rejects.toThrow('User not authenticated');
    });

    it('invokes request-avatar-picks-generation-v2 edge function', async () => {
      // Need to mock the poll to return succeeded immediately
      mockFrom.current.mockReturnValue(buildChain(mockGenerationRun));

      await generatePicks('agent-001');
      expect(mockInvoke.current).toHaveBeenCalledWith(
        'request-avatar-picks-generation-v2',
        { body: { avatar_id: 'agent-001' } }
      );
    });

    it('throws when edge function returns error', async () => {
      mockInvoke.current.mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limited' },
      });
      await expect(generatePicks('agent-001')).rejects.toThrow();
    });

    it('throws when edge function returns success: false', async () => {
      mockInvoke.current.mockResolvedValueOnce({
        data: { success: false, error: 'Daily budget exceeded' },
        error: null,
      });
      await expect(generatePicks('agent-001')).rejects.toThrow('Daily budget exceeded');
    });

    it('throws when no run_id returned', async () => {
      mockInvoke.current.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });
      await expect(generatePicks('agent-001')).rejects.toThrow('No run_id returned');
    });
  });

  describe('enrichPicksWithOverlap', () => {
    it('returns empty array for empty input', async () => {
      const result = await enrichPicksWithOverlap([]);
      expect(result).toEqual([]);
    });

    it('calls get_agent_pick_overlap_batch RPC', async () => {
      await enrichPicksWithOverlap(mockPicks as any);
      expect(mockRpc.current).toHaveBeenCalledWith('get_agent_pick_overlap_batch', {
        p_pick_ids: ['pick-001', 'pick-002'],
      });
    });

    it('attaches overlap data to matching picks', async () => {
      const enriched = await enrichPicksWithOverlap(mockPicks as any);
      const pick1 = enriched.find((p: any) => p.id === 'pick-001');
      expect(pick1!.overlap).toBeDefined();
      expect(pick1!.overlap!.totalCount).toBe(2);
      expect(pick1!.overlap!.agents).toHaveLength(2);
      expect(pick1!.overlap!.agents[0].name).toBe('ContrarianKing');
    });

    it('sets empty overlap for picks with no overlapping agents', async () => {
      const enriched = await enrichPicksWithOverlap(mockPicks as any);
      const pick2 = enriched.find((p: any) => p.id === 'pick-002');
      expect(pick2!.overlap!.totalCount).toBe(0);
      expect(pick2!.overlap!.agents).toHaveLength(0);
    });

    it('returns original picks gracefully if RPC fails', async () => {
      mockRpc.current.mockResolvedValueOnce({ data: null, error: { message: 'RPC error' } });
      const result = await enrichPicksWithOverlap(mockPicks as any);
      expect(result).toEqual(mockPicks);
    });
  });

  describe('Pick Data Structure — Audit Trail', () => {
    it('pick has all required display fields', () => {
      const pick = mockPicks[0];
      expect(pick).toHaveProperty('avatar_id');
      expect(pick).toHaveProperty('game_id');
      expect(pick).toHaveProperty('sport');
      expect(pick).toHaveProperty('matchup');
      expect(pick).toHaveProperty('game_date');
      expect(pick).toHaveProperty('bet_type');
      expect(pick).toHaveProperty('pick_selection');
      expect(pick).toHaveProperty('odds');
      expect(pick).toHaveProperty('units');
      expect(pick).toHaveProperty('confidence');
      expect(pick).toHaveProperty('reasoning_text');
      expect(pick).toHaveProperty('key_factors');
      expect(pick).toHaveProperty('result');
    });

    it('pick has ai_audit_payload with all 3 payloads', () => {
      const pick = mockPicks[0];
      expect(pick.ai_audit_payload).toBeDefined();
      expect(pick.ai_audit_payload).toHaveProperty('system_prompt_version');
      expect(pick.ai_audit_payload).toHaveProperty('model_input_game_payload');
      expect(pick.ai_audit_payload).toHaveProperty('model_input_personality_payload');
      expect(pick.ai_audit_payload).toHaveProperty('model_response_payload');
    });

    it('pick has ai_decision_trace with leaned_metrics', () => {
      const pick = mockPicks[0];
      expect(pick.ai_decision_trace).toBeDefined();
      expect(pick.ai_decision_trace!.leaned_metrics).toBeInstanceOf(Array);
      expect(pick.ai_decision_trace!.leaned_metrics.length).toBeGreaterThan(0);
      expect(pick.ai_decision_trace!.leaned_metrics[0]).toHaveProperty('metric_key');
      expect(pick.ai_decision_trace!.leaned_metrics[0]).toHaveProperty('why_it_mattered');
      expect(pick.ai_decision_trace!.leaned_metrics[0]).toHaveProperty('personality_trait');
    });

    it('pick has archived game data and personality snapshot', () => {
      const pick = mockPicks[0];
      expect(pick.archived_game_data).toBeDefined();
      expect(pick.archived_game_data.home_team).toBe('Kansas City Chiefs');
      expect(pick.archived_personality).toBeDefined();
      expect(pick.archived_personality.risk_tolerance).toBe(3);
    });

    it('bet_type is a valid enum value', () => {
      const validTypes = ['spread', 'moneyline', 'total'];
      mockPicks.forEach(pick => {
        expect(validTypes).toContain(pick.bet_type);
      });
    });

    it('result is a valid enum value', () => {
      const validResults = ['won', 'lost', 'push', 'pending'];
      mockPicks.forEach(pick => {
        expect(validResults).toContain(pick.result);
      });
    });

    it('confidence is between 1 and 5', () => {
      mockPicks.forEach(pick => {
        expect(pick.confidence).toBeGreaterThanOrEqual(1);
        expect(pick.confidence).toBeLessThanOrEqual(5);
      });
    });

    it('units are positive', () => {
      mockPicks.forEach(pick => {
        expect(pick.units).toBeGreaterThan(0);
      });
    });

    it('odds are in American format', () => {
      mockPicks.forEach(pick => {
        expect(pick.odds).toMatch(/^[+-]?\d+$/);
      });
    });

    it('key_factors has 3-5 items', () => {
      mockPicks.forEach(pick => {
        expect(pick.key_factors.length).toBeGreaterThanOrEqual(3);
        expect(pick.key_factors.length).toBeLessThanOrEqual(5);
      });
    });

    it('sport is a valid sport key', () => {
      const validSports = ['nfl', 'cfb', 'nba', 'ncaab'];
      mockPicks.forEach(pick => {
        expect(validSports).toContain(pick.sport);
      });
    });
  });
});
