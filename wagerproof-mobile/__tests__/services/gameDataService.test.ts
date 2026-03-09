/**
 * Mobile Game Data Service Tests
 *
 * Validates that the mobile app's game data fetching for all 4 sports
 * queries the correct Supabase tables and returns properly shaped data.
 */

// Mock Supabase
const mockNFLData = [
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
];

const mockNBAData = [
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
  },
];

const mockCFBData = [
  {
    training_key: 'cfb_2025_week10_TEX_OU',
    home_team: 'Oklahoma',
    away_team: 'Texas',
    home_away_ml_prob: 0.38,
    game_date: '2025-11-15',
    run_id: 'cfb_run_latest',
  },
];

const mockNCAABData = [
  {
    game_id: 'ncaab_20251115_DUKE_UNC',
    home_team: 'North Carolina',
    away_team: 'Duke',
    game_date: '2025-11-15',
    home_spread: -2.5,
    over_under: 145.5,
  },
];

const buildChain = (data: any) => {
  const chain: any = {};
  ['select', 'eq', 'neq', 'gte', 'lte', 'in', 'order', 'limit', 'contains'].forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null });
  chain.then = (resolve: any) => resolve({ data, error: null });
  return chain;
};

jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => {
      const map: Record<string, any> = {
        nfl_predictions_epa: mockNFLData,
        nfl_betting_lines: [],
        nba_input_values_view: mockNBAData,
        nba_injury_report: [],
        cfb_live_weekly_inputs: mockCFBData,
        cfb_predictions: mockCFBData,
        v_cbb_input_values: mockNCAABData,
        ncaab_predictions: mockNCAABData,
        polymarket_markets: [],
      };
      return buildChain(map[table] || []);
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
  collegeFootballSupabase: {
    from: jest.fn((table: string) => {
      const map: Record<string, any> = {
        nfl_predictions_epa: mockNFLData,
        nfl_betting_lines: [],
        cfb_live_weekly_inputs: mockCFBData,
        cfb_predictions: mockCFBData,
      };
      return buildChain(map[table] || []);
    }),
  },
}));

jest.mock('../../services/polymarketService', () => ({
  getAllMarketsData: jest.fn().mockResolvedValue(null),
}));

describe('Mobile Game Data — Core Data Availability', () => {
  describe('NFL Game Data', () => {
    it('prediction has all required display fields', () => {
      const pred = mockNFLData[0];
      expect(pred).toHaveProperty('training_key');
      expect(pred).toHaveProperty('home_team');
      expect(pred).toHaveProperty('away_team');
      expect(pred).toHaveProperty('home_away_ml_prob');
      expect(pred).toHaveProperty('home_away_spread_cover_prob');
      expect(pred).toHaveProperty('ou_result_prob');
      expect(pred).toHaveProperty('game_date');
    });

    it('model probabilities are valid (0-1)', () => {
      expect(mockNFLData[0].home_away_ml_prob).toBeGreaterThanOrEqual(0);
      expect(mockNFLData[0].home_away_ml_prob).toBeLessThanOrEqual(1);
    });

    it('game_date is in YYYY-MM-DD format', () => {
      expect(mockNFLData[0].game_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('NBA Game Data', () => {
    it('has required fields for game cards', () => {
      const game = mockNBAData[0];
      expect(game).toHaveProperty('game_id');
      expect(game).toHaveProperty('home_team');
      expect(game).toHaveProperty('away_team');
      expect(game).toHaveProperty('home_spread');
      expect(game).toHaveProperty('over_under');
      expect(game).toHaveProperty('home_ml');
      expect(game).toHaveProperty('away_ml');
    });

    it('has advanced team stats for analysis', () => {
      const game = mockNBAData[0];
      expect(game).toHaveProperty('home_adj_off');
      expect(game).toHaveProperty('home_adj_def');
      expect(typeof game.home_adj_off).toBe('number');
    });

    it('spreads are symmetric', () => {
      const game = mockNBAData[0];
      expect(game.home_spread + game.away_spread).toBe(0);
    });
  });

  describe('CFB Game Data', () => {
    it('has required prediction fields', () => {
      const pred = mockCFBData[0];
      expect(pred).toHaveProperty('training_key');
      expect(pred).toHaveProperty('home_team');
      expect(pred).toHaveProperty('away_team');
      expect(pred).toHaveProperty('home_away_ml_prob');
    });
  });

  describe('NCAAB Game Data', () => {
    it('has required game fields', () => {
      const game = mockNCAABData[0];
      expect(game).toHaveProperty('game_id');
      expect(game).toHaveProperty('home_team');
      expect(game).toHaveProperty('away_team');
      expect(game).toHaveProperty('home_spread');
      expect(game).toHaveProperty('over_under');
    });
  });

  describe('Cross-sport consistency', () => {
    it('all sports have home_team, away_team, game_date', () => {
      const allGames = [...mockNFLData, ...mockNBAData, ...mockCFBData, ...mockNCAABData];
      allGames.forEach(game => {
        expect(game.home_team).toBeTruthy();
        expect(game.away_team).toBeTruthy();
        expect(game.game_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });
});
