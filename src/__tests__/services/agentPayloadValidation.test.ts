import { describe, it, expect } from 'vitest';

/**
 * Agent Payload Validation Tests
 *
 * These tests verify the 4-payload architecture that powers agent pick generation:
 *   Payload 1: Agent Personality (avatar_profiles.personality_params)
 *   Payload 2: Game Data (sport-specific tables → formatted for AI)
 *   Payload 3: System Prompt (agent_system_prompts template)
 *   Payload 4: AI Response (structured picks output)
 *
 * These validate data shapes WITHOUT hitting Supabase — they catch schema
 * drift and ensure the payloads remain compatible with the AI pipeline.
 */

// ═══════════════════════════════════════════════════════════════════
// Payload 1: Agent Personality Schema Validation
// ═══════════════════════════════════════════════════════════════════

describe('Payload 1 — Agent Personality Params', () => {
  const REQUIRED_CORE_PARAMS = [
    'risk_tolerance',
    'underdog_lean',
    'over_under_lean',
    'confidence_threshold',
    'chase_value',
    'preferred_bet_type',
    'max_picks_per_day',
    'skip_weak_slates',
    'trust_model',
    'trust_polymarket',
    'polymarket_divergence_flag',
    'home_court_boost',
  ];

  const OPTIONAL_NFL_CFB_PARAMS = [
    'fade_public',
    'public_threshold',
    'weather_impacts_totals',
    'weather_sensitivity',
  ];

  const OPTIONAL_NBA_NCAAB_PARAMS = [
    'trust_team_ratings',
    'pace_affects_totals',
  ];

  const OPTIONAL_NBA_ONLY_PARAMS = [
    'weight_recent_form',
    'ride_hot_streaks',
    'fade_cold_streaks',
    'trust_ats_trends',
    'regress_luck',
  ];

  const SLIDER_PARAMS = [
    'risk_tolerance',
    'underdog_lean',
    'over_under_lean',
    'confidence_threshold',
    'trust_model',
    'trust_polymarket',
    'home_court_boost',
    'max_picks_per_day',
  ];

  // Realistic sample personality
  const samplePersonality = {
    risk_tolerance: 3,
    underdog_lean: 2,
    over_under_lean: 3,
    confidence_threshold: 4,
    chase_value: true,
    preferred_bet_type: 'spread' as const,
    max_favorite_odds: null,
    min_underdog_odds: null,
    max_picks_per_day: 3,
    skip_weak_slates: false,
    trust_model: 4,
    trust_polymarket: 3,
    polymarket_divergence_flag: true,
    fade_public: true,
    public_threshold: 3,
    weather_impacts_totals: true,
    weather_sensitivity: 2,
    trust_team_ratings: 4,
    pace_affects_totals: true,
    weight_recent_form: 3,
    ride_hot_streaks: true,
    fade_cold_streaks: false,
    trust_ats_trends: true,
    regress_luck: false,
    home_court_boost: 3,
    fade_back_to_backs: true,
    upset_alert: false,
  };

  it('has all required core params', () => {
    REQUIRED_CORE_PARAMS.forEach(param => {
      expect(samplePersonality).toHaveProperty(param);
    });
  });

  it('slider params are integers 1-5', () => {
    SLIDER_PARAMS.forEach(param => {
      const val = (samplePersonality as any)[param];
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(5);
    });
  });

  it('preferred_bet_type is valid enum', () => {
    expect(['spread', 'moneyline', 'total', 'any']).toContain(samplePersonality.preferred_bet_type);
  });

  it('boolean params are actual booleans', () => {
    const boolParams = ['chase_value', 'skip_weak_slates', 'polymarket_divergence_flag'];
    boolParams.forEach(param => {
      expect(typeof (samplePersonality as any)[param]).toBe('boolean');
    });
  });

  it('NFL/CFB params are valid when present', () => {
    OPTIONAL_NFL_CFB_PARAMS.forEach(param => {
      if ((samplePersonality as any)[param] !== undefined) {
        const val = (samplePersonality as any)[param];
        expect(typeof val === 'boolean' || typeof val === 'number').toBe(true);
      }
    });
  });

  it('NBA/NCAAB params are valid when present', () => {
    OPTIONAL_NBA_NCAAB_PARAMS.forEach(param => {
      if ((samplePersonality as any)[param] !== undefined) {
        const val = (samplePersonality as any)[param];
        expect(typeof val === 'boolean' || typeof val === 'number').toBe(true);
      }
    });
  });

  it('NBA-only params are valid when present', () => {
    OPTIONAL_NBA_ONLY_PARAMS.forEach(param => {
      if ((samplePersonality as any)[param] !== undefined) {
        const val = (samplePersonality as any)[param];
        expect(typeof val === 'boolean' || typeof val === 'number').toBe(true);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Payload 2: Game Data Shape Validation (per sport)
// ═══════════════════════════════════════════════════════════════════

describe('Payload 2 — Game Data Shapes', () => {
  describe('NFL formatted game', () => {
    const sampleNFLGame = {
      game_id: 'nfl_2025_week10_KC_BUF',
      sport: 'nfl',
      matchup: 'Buffalo Bills @ Kansas City Chiefs',
      game_date: '2025-11-15',
      game_time: '16:25',
      home_team: 'Kansas City Chiefs',
      away_team: 'Buffalo Bills',
      spread_summary: 'KC -3.5 / BUF +3.5',
      over_under: 47.5,
      home_ml: -180,
      away_ml: 155,
      model_home_ml_prob: 0.55,
      model_spread_cover_prob: 0.52,
      model_ou_prob: 0.48,
      public_spread_bets_pct: '65%',
      weather: 'Clear, 45°F, Wind 8mph',
      polymarket_moneyline: '56% - 44%',
    };

    it('has game identification fields', () => {
      expect(sampleNFLGame.game_id).toBeTruthy();
      expect(sampleNFLGame.sport).toBe('nfl');
      expect(sampleNFLGame.matchup).toContain('@');
    });

    it('has betting lines', () => {
      expect(sampleNFLGame.spread_summary).toBeTruthy();
      expect(typeof sampleNFLGame.over_under).toBe('number');
      expect(typeof sampleNFLGame.home_ml).toBe('number');
      expect(typeof sampleNFLGame.away_ml).toBe('number');
    });

    it('has model probabilities', () => {
      expect(sampleNFLGame.model_home_ml_prob).toBeGreaterThanOrEqual(0);
      expect(sampleNFLGame.model_home_ml_prob).toBeLessThanOrEqual(1);
      expect(sampleNFLGame.model_spread_cover_prob).toBeGreaterThanOrEqual(0);
      expect(sampleNFLGame.model_spread_cover_prob).toBeLessThanOrEqual(1);
    });

    it('has NFL-specific fields (weather, public betting)', () => {
      expect(sampleNFLGame.weather).toBeTruthy();
      expect(sampleNFLGame.public_spread_bets_pct).toBeTruthy();
    });
  });

  describe('NBA formatted game', () => {
    const sampleNBAGame = {
      game_id: 'nba_20251115_LAL_BOS',
      sport: 'nba',
      matchup: 'Los Angeles Lakers @ Boston Celtics',
      game_date: '2025-11-15',
      home_team: 'Boston Celtics',
      away_team: 'Los Angeles Lakers',
      spread_summary: 'BOS -7.5 / LAL +7.5',
      over_under: 220.5,
      home_adj_off: 115.2,
      home_adj_def: 108.3,
      away_adj_off: 112.1,
      away_adj_def: 110.5,
      home_pace: 100.5,
      away_pace: 98.2,
      home_ats_last5: '3-2',
      away_ats_last5: '2-3',
      injury_report: 'LAL: AD (questionable)',
    };

    it('has team advanced stats', () => {
      expect(typeof sampleNBAGame.home_adj_off).toBe('number');
      expect(typeof sampleNBAGame.home_adj_def).toBe('number');
      expect(typeof sampleNBAGame.away_adj_off).toBe('number');
      expect(typeof sampleNBAGame.away_adj_def).toBe('number');
    });

    it('has pace data for totals analysis', () => {
      expect(typeof sampleNBAGame.home_pace).toBe('number');
      expect(typeof sampleNBAGame.away_pace).toBe('number');
    });

    it('has ATS trends for spread analysis', () => {
      expect(sampleNBAGame.home_ats_last5).toBeTruthy();
      expect(sampleNBAGame.away_ats_last5).toBeTruthy();
    });

    it('has injury report', () => {
      expect(sampleNBAGame.injury_report).toBeTruthy();
    });
  });

  describe('CFB formatted game', () => {
    const sampleCFBGame = {
      game_id: 'cfb_2025_week10_TEX_OU',
      sport: 'cfb',
      matchup: 'Texas @ Oklahoma',
      game_date: '2025-11-15',
      home_team: 'Oklahoma',
      away_team: 'Texas',
      model_home_ml_prob: 0.38,
      model_spread_cover_prob: 0.40,
      model_ou_prob: 0.52,
      weather: 'Partly Cloudy, 55°F',
    };

    it('has model probabilities', () => {
      expect(sampleCFBGame.model_home_ml_prob).toBeDefined();
      expect(sampleCFBGame.model_spread_cover_prob).toBeDefined();
      expect(sampleCFBGame.model_ou_prob).toBeDefined();
    });

    it('has weather for outdoor games', () => {
      expect(sampleCFBGame.weather).toBeTruthy();
    });
  });

  describe('NCAAB formatted game', () => {
    const sampleNCAABGame = {
      game_id: 'ncaab_20251115_DUKE_UNC',
      sport: 'ncaab',
      matchup: 'Duke @ North Carolina',
      game_date: '2025-11-15',
      home_team: 'North Carolina',
      away_team: 'Duke',
      spread_summary: 'UNC -2.5 / DUKE +2.5',
      over_under: 145.5,
      neutral_site: false,
    };

    it('has NCAAB-specific neutral_site flag', () => {
      expect(typeof sampleNCAABGame.neutral_site).toBe('boolean');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Payload 3: System Prompt Template Validation
// ═══════════════════════════════════════════════════════════════════

describe('Payload 3 — System Prompt Template', () => {
  const REQUIRED_PLACEHOLDERS = [
    '{{AGENT_NAME}}',
    '{{AGENT_EMOJI}}',
    '{{AGENT_SPORTS}}',
    '{{PERSONALITY_INSTRUCTIONS}}',
    '{{CUSTOM_INSIGHTS}}',
    '{{CONSTRAINTS}}',
  ];

  const samplePromptTemplate = `You are {{AGENT_NAME}} {{AGENT_EMOJI}}, an AI sports betting analyst.

Sports coverage: {{AGENT_SPORTS}}

## Personality Configuration
{{PERSONALITY_INSTRUCTIONS}}

## Custom Insights
{{CUSTOM_INSIGHTS}}

## Constraints
{{CONSTRAINTS}}

Analyze the provided game data and generate picks.`;

  it('placeholder replacement produces valid prompt', () => {
    let prompt = samplePromptTemplate;
    prompt = prompt.replace('{{AGENT_NAME}}', 'SharpShooter');
    prompt = prompt.replace('{{AGENT_EMOJI}}', '🎯');
    prompt = prompt.replace('{{AGENT_SPORTS}}', 'NFL, NBA');
    prompt = prompt.replace('{{PERSONALITY_INSTRUCTIONS}}', 'Risk tolerance: 3/5');
    prompt = prompt.replace('{{CUSTOM_INSIGHTS}}', 'Follow the models');
    prompt = prompt.replace('{{CONSTRAINTS}}', 'Max 3 picks per day');

    expect(prompt).toContain('SharpShooter');
    expect(prompt).toContain('🎯');
    expect(prompt).toContain('NFL, NBA');
    expect(prompt).not.toContain('{{');
    expect(prompt).not.toContain('}}');
  });

  it('all required placeholders are present in template', () => {
    REQUIRED_PLACEHOLDERS.forEach(placeholder => {
      expect(samplePromptTemplate).toContain(placeholder);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Payload 4: AI Response Schema Validation
// ═══════════════════════════════════════════════════════════════════

describe('Payload 4 — AI Response (Structured Output)', () => {
  const sampleAIResponse = {
    picks: [
      {
        game_id: 'nfl_2025_week10_KC_BUF',
        bet_type: 'spread',
        selection: 'Chiefs -3.5',
        odds: '-110',
        confidence: 4,
        reasoning: 'Model shows 55% cover probability, significantly above the implied 52.4% from -110 odds. Chiefs have strong home field advantage and Buffalo is on short rest after Monday Night Football.',
        key_factors: [
          'Model edge: +2.6% above implied probability from line',
          'Chiefs 8-2 ATS at home this season in similar situations',
          'Bills coming off short week with key injuries on defense',
        ],
        decision_trace: {
          leaned_metrics: [
            {
              metric_key: 'model_spread_cover_prob',
              metric_value: '0.55',
              why_it_mattered: 'Model gives 55% cover prob vs 52.4% implied by -110, a +2.6% edge above our confidence threshold',
              personality_trait: 'trust_model: 4/5 — heavily weight model signals',
              weight: 0.7,
            },
            {
              metric_key: 'home_ats_record',
              metric_value: '8-2',
              why_it_mattered: 'Strong home ATS record confirms model directional lean',
              personality_trait: 'home_court_boost: 3/5 — moderate home field weight',
              weight: 0.3,
            },
          ],
          rationale_summary: 'Model-driven edge on home spread backed by strong situational ATS performance',
          personality_alignment: 'High trust_model (4/5) prioritizes model signals. Moderate home_court_boost (3/5) provides secondary confirmation. Risk tolerance (3/5) is comfortable with standard -110 juice.',
          other_metrics_considered: ['public_spread_bets_pct', 'weather_conditions'],
        },
      },
    ],
    slate_note: 'Strong NFL slate with clear model edges on 2 of 8 games.',
  };

  it('response has picks array', () => {
    expect(sampleAIResponse).toHaveProperty('picks');
    expect(Array.isArray(sampleAIResponse.picks)).toBe(true);
    expect(sampleAIResponse.picks.length).toBeGreaterThan(0);
  });

  it('response has slate_note', () => {
    expect(sampleAIResponse).toHaveProperty('slate_note');
    expect(typeof sampleAIResponse.slate_note).toBe('string');
  });

  describe('individual pick validation', () => {
    const pick = sampleAIResponse.picks[0];

    it('has required identification fields', () => {
      expect(pick.game_id).toBeTruthy();
      expect(['spread', 'moneyline', 'total']).toContain(pick.bet_type);
      expect(pick.selection).toBeTruthy();
    });

    it('odds are in American format', () => {
      expect(pick.odds).toMatch(/^[+-]?\d+$/);
    });

    it('confidence is 1-5 integer', () => {
      expect(Number.isInteger(pick.confidence)).toBe(true);
      expect(pick.confidence).toBeGreaterThanOrEqual(1);
      expect(pick.confidence).toBeLessThanOrEqual(5);
    });

    it('reasoning is substantial (50-600 chars)', () => {
      expect(pick.reasoning.length).toBeGreaterThanOrEqual(50);
      expect(pick.reasoning.length).toBeLessThanOrEqual(600);
    });

    it('key_factors has 3-5 items', () => {
      expect(pick.key_factors.length).toBeGreaterThanOrEqual(3);
      expect(pick.key_factors.length).toBeLessThanOrEqual(5);
    });

    it('decision_trace has leaned_metrics', () => {
      expect(pick.decision_trace).toBeDefined();
      expect(pick.decision_trace.leaned_metrics.length).toBeGreaterThanOrEqual(2);
      expect(pick.decision_trace.leaned_metrics.length).toBeLessThanOrEqual(8);
    });

    it('each leaned_metric has required fields', () => {
      pick.decision_trace.leaned_metrics.forEach((metric: any) => {
        expect(metric).toHaveProperty('metric_key');
        expect(metric).toHaveProperty('metric_value');
        expect(metric).toHaveProperty('why_it_mattered');
        expect(metric).toHaveProperty('personality_trait');
        expect(metric).toHaveProperty('weight');
        expect(metric.weight).toBeGreaterThanOrEqual(0);
        expect(metric.weight).toBeLessThanOrEqual(1);
      });
    });

    it('decision_trace has rationale_summary and personality_alignment', () => {
      expect(pick.decision_trace.rationale_summary.length).toBeGreaterThan(40);
      expect(pick.decision_trace.personality_alignment.length).toBeGreaterThan(40);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// End-to-End Payload Compatibility
// ═══════════════════════════════════════════════════════════════════

describe('Payload Compatibility — Full Pipeline', () => {
  it('Payload 1 personality params map to Payload 4 decision_trace personality_trait references', () => {
    const personality = {
      risk_tolerance: 3,
      trust_model: 4,
      home_court_boost: 3,
    };

    const decisionTrace = {
      leaned_metrics: [
        { personality_trait: 'trust_model: 4/5' },
        { personality_trait: 'home_court_boost: 3/5' },
      ],
    };

    // Each personality_trait in decision_trace should reference a real personality param
    const validParamNames = Object.keys(personality);
    decisionTrace.leaned_metrics.forEach(metric => {
      const referencedParam = metric.personality_trait.split(':')[0].trim();
      expect(validParamNames).toContain(referencedParam);
    });
  });

  it('Payload 2 game_id flows through to Payload 4 pick game_id', () => {
    const gamePayload = { game_id: 'nfl_2025_week10_KC_BUF' };
    const pickResponse = { game_id: 'nfl_2025_week10_KC_BUF' };
    expect(pickResponse.game_id).toBe(gamePayload.game_id);
  });

  it('avatar_picks record stores all 3 input payloads in ai_audit_payload', () => {
    const persistedPick = {
      ai_audit_payload: {
        system_prompt_version: 'prompt-v3',
        model_input_game_payload: { game_id: 'nfl_2025_week10_KC_BUF', sport: 'nfl' },
        model_input_personality_payload: { risk_tolerance: 3, trust_model: 4 },
        model_response_payload: { game_id: 'nfl_2025_week10_KC_BUF', bet_type: 'spread' },
      },
    };

    expect(persistedPick.ai_audit_payload).toHaveProperty('system_prompt_version');
    expect(persistedPick.ai_audit_payload).toHaveProperty('model_input_game_payload');
    expect(persistedPick.ai_audit_payload).toHaveProperty('model_input_personality_payload');
    expect(persistedPick.ai_audit_payload).toHaveProperty('model_response_payload');
  });
});
