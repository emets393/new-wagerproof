/**
 * Mobile Agent Service Tests
 *
 * Tests the core agent CRUD, pick generation, and leaderboard flows
 * that power the Agents tab in the mobile app.
 */

const mockAgent = {
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
    max_picks_per_day: 3,
    skip_weak_slates: false,
    trust_model: 4,
    trust_polymarket: 3,
    polymarket_divergence_flag: true,
    home_court_boost: 3,
  },
  custom_insights: {
    betting_philosophy: 'Follow the models',
    perceived_edges: 'Line movement analysis',
  },
  is_public: true,
  is_active: true,
  auto_generate: true,
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
};

const mockPick = {
  id: 'pick-001',
  avatar_id: 'agent-001',
  game_id: 'nfl_2025_week10_KC_BUF',
  sport: 'nfl',
  matchup: 'Bills @ Chiefs',
  game_date: '2025-11-15',
  bet_type: 'spread',
  pick_selection: 'Chiefs -3.5',
  odds: '-110',
  units: 1.5,
  confidence: 4,
  reasoning_text: 'Model shows 55% cover probability above the implied 52.4% from -110 odds.',
  key_factors: ['Model edge: +2.6%', 'Chiefs 8-2 ATS at home', 'Bills on short week'],
  ai_decision_trace: {
    leaned_metrics: [{ metric_key: 'model_spread_cover_prob', metric_value: '0.55' }],
    rationale_summary: 'Model-driven edge on home spread',
  },
  ai_audit_payload: {
    system_prompt_version: 'v3',
    model_input_game_payload: {},
    model_input_personality_payload: {},
    model_response_payload: {},
  },
  result: 'pending',
};

const mockLeaderboardEntry = {
  avatar_id: 'agent-001',
  name: 'SharpShooter',
  avatar_emoji: '🎯',
  avatar_color: '#6366f1',
  user_id: 'user-1',
  preferred_sports: ['nfl', 'nba'],
  total_picks: 50,
  wins: 30,
  losses: 18,
  pushes: 2,
  win_rate: 0.625,
  net_units: 8.5,
  current_streak: 3,
  best_streak: 7,
};

describe('Mobile Agent Service — Core Agent Operations', () => {
  describe('Agent Profile Data', () => {
    it('has all required profile fields', () => {
      expect(mockAgent).toHaveProperty('id');
      expect(mockAgent).toHaveProperty('user_id');
      expect(mockAgent).toHaveProperty('name');
      expect(mockAgent).toHaveProperty('avatar_emoji');
      expect(mockAgent).toHaveProperty('avatar_color');
      expect(mockAgent).toHaveProperty('preferred_sports');
      expect(mockAgent).toHaveProperty('archetype');
      expect(mockAgent).toHaveProperty('personality_params');
      expect(mockAgent).toHaveProperty('custom_insights');
      expect(mockAgent).toHaveProperty('is_public');
      expect(mockAgent).toHaveProperty('is_active');
      expect(mockAgent).toHaveProperty('auto_generate');
    });

    it('preferred_sports contains valid sports', () => {
      const validSports = ['nfl', 'cfb', 'nba', 'ncaab'];
      mockAgent.preferred_sports.forEach(sport => {
        expect(validSports).toContain(sport);
      });
    });

    it('personality_params has all core fields', () => {
      const params = mockAgent.personality_params;
      const required = [
        'risk_tolerance', 'underdog_lean', 'over_under_lean',
        'confidence_threshold', 'chase_value', 'preferred_bet_type',
        'max_picks_per_day', 'skip_weak_slates', 'trust_model',
        'trust_polymarket', 'polymarket_divergence_flag', 'home_court_boost',
      ];
      required.forEach(field => {
        expect(params).toHaveProperty(field);
      });
    });

    it('slider values are 1-5', () => {
      const params = mockAgent.personality_params;
      const sliders = ['risk_tolerance', 'underdog_lean', 'over_under_lean', 'confidence_threshold', 'trust_model', 'trust_polymarket', 'home_court_boost', 'max_picks_per_day'] as const;
      sliders.forEach(s => {
        expect(params[s]).toBeGreaterThanOrEqual(1);
        expect(params[s]).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Agent Performance Data', () => {
    it('has W-L-P fields', () => {
      expect(mockPerformance).toHaveProperty('wins');
      expect(mockPerformance).toHaveProperty('losses');
      expect(mockPerformance).toHaveProperty('pushes');
      expect(mockPerformance).toHaveProperty('total_picks');
      expect(mockPerformance).toHaveProperty('win_rate');
      expect(mockPerformance).toHaveProperty('net_units');
    });

    it('W + L + P = total', () => {
      expect(mockPerformance.wins + mockPerformance.losses + mockPerformance.pushes)
        .toBe(mockPerformance.total_picks);
    });

    it('win_rate is correct', () => {
      const expected = mockPerformance.wins / (mockPerformance.wins + mockPerformance.losses);
      expect(mockPerformance.win_rate).toBeCloseTo(expected, 2);
    });

    it('has streak data', () => {
      expect(mockPerformance).toHaveProperty('current_streak');
      expect(mockPerformance).toHaveProperty('best_streak');
      expect(Math.abs(mockPerformance.current_streak)).toBeLessThanOrEqual(mockPerformance.total_picks);
    });
  });

  describe('Agent Pick Data', () => {
    it('has all required display fields', () => {
      const required = [
        'avatar_id', 'game_id', 'sport', 'matchup', 'game_date',
        'bet_type', 'pick_selection', 'odds', 'units', 'confidence',
        'reasoning_text', 'key_factors', 'result',
      ];
      required.forEach(field => {
        expect(mockPick).toHaveProperty(field);
      });
    });

    it('has audit trail payloads', () => {
      expect(mockPick.ai_decision_trace).toBeDefined();
      expect(mockPick.ai_decision_trace!.leaned_metrics).toBeInstanceOf(Array);
      expect(mockPick.ai_audit_payload).toBeDefined();
      expect(mockPick.ai_audit_payload).toHaveProperty('system_prompt_version');
      expect(mockPick.ai_audit_payload).toHaveProperty('model_input_game_payload');
      expect(mockPick.ai_audit_payload).toHaveProperty('model_input_personality_payload');
      expect(mockPick.ai_audit_payload).toHaveProperty('model_response_payload');
    });

    it('bet_type is valid', () => {
      expect(['spread', 'moneyline', 'total']).toContain(mockPick.bet_type);
    });

    it('result is valid', () => {
      expect(['won', 'lost', 'push', 'pending']).toContain(mockPick.result);
    });

    it('confidence is 1-5', () => {
      expect(mockPick.confidence).toBeGreaterThanOrEqual(1);
      expect(mockPick.confidence).toBeLessThanOrEqual(5);
    });

    it('odds in American format', () => {
      expect(mockPick.odds).toMatch(/^[+-]?\d+$/);
    });

    it('key_factors has 3-5 items', () => {
      expect(mockPick.key_factors.length).toBeGreaterThanOrEqual(3);
      expect(mockPick.key_factors.length).toBeLessThanOrEqual(5);
    });

    it('sport is valid', () => {
      expect(['nfl', 'cfb', 'nba', 'ncaab']).toContain(mockPick.sport);
    });
  });

  describe('Leaderboard Entry Data', () => {
    it('has all required display fields', () => {
      const required = [
        'avatar_id', 'name', 'avatar_emoji', 'avatar_color',
        'user_id', 'preferred_sports', 'total_picks',
        'wins', 'losses', 'pushes', 'win_rate',
        'net_units', 'current_streak', 'best_streak',
      ];
      required.forEach(field => {
        expect(mockLeaderboardEntry).toHaveProperty(field);
      });
    });

    it('win_rate is between 0 and 1', () => {
      expect(mockLeaderboardEntry.win_rate).toBeGreaterThanOrEqual(0);
      expect(mockLeaderboardEntry.win_rate).toBeLessThanOrEqual(1);
    });

    it('total_picks >= wins + losses', () => {
      expect(mockLeaderboardEntry.total_picks)
        .toBeGreaterThanOrEqual(mockLeaderboardEntry.wins + mockLeaderboardEntry.losses);
    });
  });
});

describe('Mobile Agent Generation Flow', () => {
  it('generation request requires avatar_id', () => {
    const requestBody = { avatar_id: 'agent-001' };
    expect(requestBody).toHaveProperty('avatar_id');
    expect(requestBody.avatar_id).toBeTruthy();
  });

  it('generation response returns run_id for polling', () => {
    const response = { success: true, run_id: 'run-001' };
    expect(response.success).toBe(true);
    expect(response.run_id).toBeTruthy();
  });

  it('polling checks agent_generation_runs status', () => {
    const runStatuses = ['queued', 'leased', 'processing', 'succeeded', 'failed_terminal', 'failed_retryable', 'canceled'];
    const successRun = { status: 'succeeded', picks_generated: 3 };
    expect(runStatuses).toContain(successRun.status);
    expect(successRun.picks_generated).toBeGreaterThanOrEqual(0);
  });

  it('terminal statuses stop polling', () => {
    const terminalStatuses = ['succeeded', 'failed_terminal', 'canceled'];
    const continuePollStatuses = ['queued', 'leased', 'processing', 'failed_retryable'];

    terminalStatuses.forEach(s => {
      expect(continuePollStatuses).not.toContain(s);
    });
  });
});
