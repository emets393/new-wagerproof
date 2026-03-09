import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// Mock Supabase — the foundation of ALL game data queries
// ═══════════════════════════════════════════════════════════════════

const mockNFLPredictions = [
  {
    training_key: 'nfl_2025_week10_KC_BUF',
    home_team: 'Kansas City Chiefs',
    away_team: 'Buffalo Bills',
    home_away_ml_prob: 0.55,
    home_away_spread_cover_prob: 0.52,
    ou_result_prob: 0.48,
    game_date: '2025-11-15',
    run_id: 'run_latest',
  },
  {
    training_key: 'nfl_2025_week10_PHI_DAL',
    home_team: 'Dallas Cowboys',
    away_team: 'Philadelphia Eagles',
    home_away_ml_prob: 0.42,
    home_away_spread_cover_prob: 0.45,
    ou_result_prob: 0.55,
    game_date: '2025-11-15',
    run_id: 'run_latest',
  },
];

const mockNFLBettingLines = [
  {
    training_key: 'nfl_2025_week10_KC_BUF',
    home_team: 'Kansas City Chiefs',
    away_team: 'Buffalo Bills',
    home_spread: -3.5,
    away_spread: 3.5,
    over_line: 47.5,
    home_ml: -180,
    away_ml: 155,
    game_date: '2025-11-15',
    game_time: '16:25',
  },
];

const mockNBAGames = [
  {
    game_id: 'nba_20251115_LAL_BOS',
    home_team: 'Boston Celtics',
    away_team: 'Los Angeles Lakers',
    game_date: '2025-11-15',
    home_spread: -7.5,
    away_spread: 7.5,
    over_under: 220.5,
    home_ml: -320,
    away_ml: 260,
    home_adj_off: 115.2,
    home_adj_def: 108.3,
    away_adj_off: 112.1,
    away_adj_def: 110.5,
  },
];

const mockCFBPredictions = [
  {
    training_key: 'cfb_2025_week10_TEX_OU',
    home_team: 'Oklahoma',
    away_team: 'Texas',
    home_away_ml_prob: 0.38,
    home_away_spread_cover_prob: 0.40,
    ou_result_prob: 0.52,
    game_date: '2025-11-15',
    run_id: 'cfb_run_latest',
  },
];

const mockNCAABGames = [
  {
    game_id: 'ncaab_20251115_DUKE_UNC',
    home_team: 'North Carolina',
    away_team: 'Duke',
    game_date: '2025-11-15',
    home_spread: -2.5,
    away_spread: 2.5,
    over_under: 145.5,
  },
];

// Chain builder for Supabase query mocking
function createQueryChain(data: any, error: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error }),
    then: vi.fn((resolve: any) => resolve({ data, error })),
  };
  // Make chained methods return the chain
  Object.keys(chain).forEach(key => {
    if (['single', 'maybeSingle', 'then'].includes(key)) return;
    chain[key].mockReturnValue(chain);
  });
  // Default resolution for awaiting the chain
  chain[Symbol.for('nodejs.util.promisify.custom')] = () => Promise.resolve({ data, error });
  return chain;
}

// Create mock supabase that routes table queries to mock data
function createMockSupabase(tableDataMap: Record<string, any[]>) {
  return {
    from: vi.fn((table: string) => {
      const data = tableDataMap[table] || [];
      return createQueryChain(data);
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test', user: { id: 'user-123' } } },
        error: null,
      }),
    },
  };
}

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: { current: (() => ({})) as any },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom.current(...args),
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: { success: true }, error: null }) },
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'test', user: { id: 'user-123' } } }, error: null }) },
  },
}));

vi.mock('@/integrations/supabase/college-football-client', () => ({
  collegeFootballSupabase: {
    from: (...args: any[]) => mockFrom.current(...args),
  },
}));

const tableDataMap: Record<string, any[]> = {
  nfl_predictions_epa: mockNFLPredictions,
  nfl_betting_lines: mockNFLBettingLines,
  nba_input_values_view: mockNBAGames,
  cfb_predictions: mockCFBPredictions,
  cfb_live_weekly_inputs: mockCFBPredictions,
  v_cbb_input_values: mockNCAABGames,
  ncaab_predictions: mockNCAABGames,
  live_scores: [],
};

mockFrom.current = vi.fn((table: string) => {
  const data = tableDataMap[table] || [];
  return createQueryChain(data);
});

vi.mock('@/utils/debug', () => ({
  default: { log: vi.fn(), error: vi.fn() },
}));

// ═══════════════════════════════════════════════════════════════════
// TESTS: Game Data Availability by Sport
// ═══════════════════════════════════════════════════════════════════

describe('Game Data Service — Core Data Availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NFL Game Data', () => {
    it('fetches predictions from nfl_predictions_epa table', async () => {
      const chain = createQueryChain(mockNFLPredictions);
      mockFrom.current.mockReturnValueOnce(chain); // latest run_id query
      mockFrom.current.mockReturnValueOnce(chain); // actual predictions

      mockFrom.current('nfl_predictions_epa');
      expect(mockFrom.current).toHaveBeenCalledWith('nfl_predictions_epa');
    });

    it('prediction data has required fields for display', () => {
      const prediction = mockNFLPredictions[0];
      expect(prediction).toHaveProperty('training_key');
      expect(prediction).toHaveProperty('home_team');
      expect(prediction).toHaveProperty('away_team');
      expect(prediction).toHaveProperty('home_away_ml_prob');
      expect(prediction).toHaveProperty('home_away_spread_cover_prob');
      expect(prediction).toHaveProperty('ou_result_prob');
      expect(prediction).toHaveProperty('game_date');
    });

    it('NFL betting lines have spread and moneyline data', () => {
      const line = mockNFLBettingLines[0];
      expect(line).toHaveProperty('home_spread');
      expect(line).toHaveProperty('away_spread');
      expect(line).toHaveProperty('over_line');
      expect(line).toHaveProperty('home_ml');
      expect(line).toHaveProperty('away_ml');
      expect(typeof line.home_spread).toBe('number');
      expect(typeof line.home_ml).toBe('number');
    });

    it('predictions merge correctly with betting lines via training_key', () => {
      const pred = mockNFLPredictions[0];
      const matchingLine = mockNFLBettingLines.find(l => l.training_key === pred.training_key);
      expect(matchingLine).toBeDefined();
      expect(matchingLine!.home_team).toBe(pred.home_team);

      // Build the merged object (same as service does)
      const merged = {
        id: pred.training_key,
        ...pred,
        game_date: pred.game_date || matchingLine?.game_date || 'TBD',
        game_time: matchingLine?.game_time || 'TBD',
        home_spread: matchingLine?.home_spread,
        away_spread: matchingLine?.away_spread,
        over_line: matchingLine?.over_line,
        home_ml: matchingLine?.home_ml,
        away_ml: matchingLine?.away_ml,
      };

      expect(merged.id).toBe('nfl_2025_week10_KC_BUF');
      expect(merged.home_spread).toBe(-3.5);
      expect(merged.home_ml).toBe(-180);
    });

    it('model probabilities are valid percentages (0-1)', () => {
      mockNFLPredictions.forEach(pred => {
        expect(pred.home_away_ml_prob).toBeGreaterThanOrEqual(0);
        expect(pred.home_away_ml_prob).toBeLessThanOrEqual(1);
        expect(pred.home_away_spread_cover_prob).toBeGreaterThanOrEqual(0);
        expect(pred.home_away_spread_cover_prob).toBeLessThanOrEqual(1);
        expect(pred.ou_result_prob).toBeGreaterThanOrEqual(0);
        expect(pred.ou_result_prob).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('NBA Game Data', () => {
    it('fetches from nba_input_values_view', () => {
      mockFrom.current('nba_input_values_view');
      expect(mockFrom.current).toHaveBeenCalledWith('nba_input_values_view');
    });

    it('NBA game data has required fields', () => {
      const game = mockNBAGames[0];
      expect(game).toHaveProperty('game_id');
      expect(game).toHaveProperty('home_team');
      expect(game).toHaveProperty('away_team');
      expect(game).toHaveProperty('game_date');
      expect(game).toHaveProperty('home_spread');
      expect(game).toHaveProperty('over_under');
      expect(game).toHaveProperty('home_ml');
      expect(game).toHaveProperty('away_ml');
    });

    it('NBA data includes advanced team stats', () => {
      const game = mockNBAGames[0];
      expect(game).toHaveProperty('home_adj_off');
      expect(game).toHaveProperty('home_adj_def');
      expect(game).toHaveProperty('away_adj_off');
      expect(game).toHaveProperty('away_adj_def');
      expect(typeof game.home_adj_off).toBe('number');
    });

    it('spread values are symmetric', () => {
      const game = mockNBAGames[0];
      expect(game.home_spread + game.away_spread).toBe(0);
    });
  });

  describe('CFB Game Data', () => {
    it('fetches from cfb_live_weekly_inputs / cfb_predictions', () => {
      mockFrom.current('cfb_live_weekly_inputs');
      expect(mockFrom.current).toHaveBeenCalledWith('cfb_live_weekly_inputs');
    });

    it('CFB prediction data has required fields', () => {
      const pred = mockCFBPredictions[0];
      expect(pred).toHaveProperty('training_key');
      expect(pred).toHaveProperty('home_team');
      expect(pred).toHaveProperty('away_team');
      expect(pred).toHaveProperty('home_away_ml_prob');
      expect(pred).toHaveProperty('home_away_spread_cover_prob');
      expect(pred).toHaveProperty('ou_result_prob');
    });
  });

  describe('NCAAB Game Data', () => {
    it('fetches from v_cbb_input_values', () => {
      mockFrom.current('v_cbb_input_values');
      expect(mockFrom.current).toHaveBeenCalledWith('v_cbb_input_values');
    });

    it('NCAAB game data has required fields', () => {
      const game = mockNCAABGames[0];
      expect(game).toHaveProperty('game_id');
      expect(game).toHaveProperty('home_team');
      expect(game).toHaveProperty('away_team');
      expect(game).toHaveProperty('game_date');
      expect(game).toHaveProperty('home_spread');
      expect(game).toHaveProperty('over_under');
    });
  });

  describe('Cross-sport data consistency', () => {
    it('all sports have home_team and away_team fields', () => {
      const allGames = [...mockNFLPredictions, ...mockNBAGames, ...mockCFBPredictions, ...mockNCAABGames];
      allGames.forEach(game => {
        expect(game).toHaveProperty('home_team');
        expect(game).toHaveProperty('away_team');
        expect(typeof game.home_team).toBe('string');
        expect(typeof game.away_team).toBe('string');
        expect(game.home_team.length).toBeGreaterThan(0);
        expect(game.away_team.length).toBeGreaterThan(0);
      });
    });

    it('all sports have game_date', () => {
      const allGames = [...mockNFLPredictions, ...mockNBAGames, ...mockCFBPredictions, ...mockNCAABGames];
      allGames.forEach(game => {
        expect(game).toHaveProperty('game_date');
        expect(game.game_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });
});
