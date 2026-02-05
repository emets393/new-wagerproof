import { z } from 'zod';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const SPORTS = ['nfl', 'cfb', 'nba', 'ncaab'] as const;
export type Sport = (typeof SPORTS)[number];

export const BET_TYPES = ['spread', 'moneyline', 'total', 'any'] as const;
export type BetType = (typeof BET_TYPES)[number];

export const PICK_RESULTS = ['won', 'lost', 'push', 'pending'] as const;
export type PickResult = (typeof PICK_RESULTS)[number];

export const ARCHETYPE_IDS = [
  'contrarian',
  'chalk_grinder',
  'plus_money_hunter',
  'model_truther',
  'polymarket_prophet',
  'momentum_rider',
  'weather_watcher',
  'the_analyst',
] as const;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

// 1-5 scale type
export type Scale1To5 = 1 | 2 | 3 | 4 | 5;

// ============================================================================
// PERSONALITY PARAMS INTERFACE
// ============================================================================

export interface PersonalityParams {
  // Core Personality (always present)
  risk_tolerance: Scale1To5;
  underdog_lean: Scale1To5;
  over_under_lean: Scale1To5;
  confidence_threshold: Scale1To5;
  chase_value: boolean;

  // Bet Selection (always present)
  preferred_bet_type: BetType;
  max_favorite_odds: number | null; // e.g., -200 or null for no limit
  min_underdog_odds: number | null; // e.g., +150 or null for no limit
  max_picks_per_day: Scale1To5;
  skip_weak_slates: boolean;

  // Data Trust (always present)
  trust_model: Scale1To5;
  trust_polymarket: Scale1To5;
  polymarket_divergence_flag: boolean;

  // NFL/CFB only (optional)
  fade_public?: boolean;
  public_threshold?: Scale1To5; // only if fade_public=true
  weather_impacts_totals?: boolean;
  weather_sensitivity?: Scale1To5; // only if weather_impacts_totals=true

  // NBA/NCAAB only (optional)
  trust_team_ratings?: Scale1To5;
  pace_affects_totals?: boolean;

  // NBA only (optional)
  weight_recent_form?: Scale1To5;
  ride_hot_streaks?: boolean;
  fade_cold_streaks?: boolean;
  trust_ats_trends?: boolean;
  regress_luck?: boolean;

  // Situational (conditional)
  home_court_boost: Scale1To5; // always
  fade_back_to_backs?: boolean; // NBA/NCAAB only
  upset_alert?: boolean; // NCAAB only
}

// ============================================================================
// CUSTOM INSIGHTS INTERFACE
// ============================================================================

export interface CustomInsights {
  betting_philosophy: string | null; // max 500 chars
  perceived_edges: string | null; // max 500 chars
  avoid_situations: string | null; // max 300 chars
  target_situations: string | null; // max 300 chars
}

// ============================================================================
// AGENT PROFILE INTERFACE
// ============================================================================

export interface AgentProfile {
  id: string;
  user_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  preferred_sports: Sport[];
  archetype: ArchetypeId | null;
  personality_params: PersonalityParams;
  custom_insights: CustomInsights;
  is_public: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  auto_generate: boolean;
  last_generated_at: string | null;
  last_auto_generated_at: string | null;
  owner_last_active_at: string | null;
  daily_generation_count: number;
  last_generation_date: string | null;
}

// ============================================================================
// AGENT PICK INTERFACE
// ============================================================================

export interface AgentPick {
  id: string;
  avatar_id: string;
  game_id: string;
  sport: Sport;
  matchup: string;
  game_date: string;
  bet_type: Exclude<BetType, 'any'>; // Actual picks can't be 'any'
  pick_selection: string;
  odds: string | null;
  units: number;
  confidence: Scale1To5;
  reasoning_text: string;
  key_factors: string[] | null;
  archived_game_data: Record<string, unknown>;
  archived_personality: PersonalityParams;
  result: PickResult;
  actual_result: string | null;
  graded_at: string | null;
  created_at: string;
}

// ============================================================================
// AGENT PERFORMANCE INTERFACE
// ============================================================================

export interface SportStats {
  wins: number;
  losses: number;
  pushes: number;
  total: number;
}

export interface BetTypeStats {
  wins: number;
  losses: number;
  pushes: number;
  total: number;
}

export interface AgentPerformance {
  avatar_id: string;
  total_picks: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  win_rate: number | null;
  net_units: number;
  current_streak: number;
  best_streak: number;
  worst_streak: number;
  stats_by_sport: Partial<Record<Sport, SportStats>>;
  stats_by_bet_type: Partial<Record<Exclude<BetType, 'any'>, BetTypeStats>>;
  last_calculated_at: string;
}

// ============================================================================
// PRESET ARCHETYPE INTERFACE
// ============================================================================

export interface PresetArchetype {
  id: ArchetypeId;
  name: string;
  description: string;
  philosophy: string;
  emoji: string;
  color: string;
  recommended_sports: Sport[];
  personality_params: Partial<PersonalityParams>;
  custom_insights: CustomInsights;
  display_order: number;
  is_active: boolean;
}

// ============================================================================
// AGENT WITH PERFORMANCE (combined for list views)
// ============================================================================

export interface AgentWithPerformance extends AgentProfile {
  performance: AgentPerformance | null;
}

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

const Scale1To5Schema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const PersonalityParamsSchema = z.object({
  // Core Personality
  risk_tolerance: Scale1To5Schema,
  underdog_lean: Scale1To5Schema,
  over_under_lean: Scale1To5Schema,
  confidence_threshold: Scale1To5Schema,
  chase_value: z.boolean(),

  // Bet Selection
  preferred_bet_type: z.enum(BET_TYPES),
  max_favorite_odds: z.number().max(-100).nullable(),
  min_underdog_odds: z.number().min(100).nullable(),
  max_picks_per_day: Scale1To5Schema,
  skip_weak_slates: z.boolean(),

  // Data Trust
  trust_model: Scale1To5Schema,
  trust_polymarket: Scale1To5Schema,
  polymarket_divergence_flag: z.boolean(),

  // NFL/CFB only
  fade_public: z.boolean().optional(),
  public_threshold: Scale1To5Schema.optional(),
  weather_impacts_totals: z.boolean().optional(),
  weather_sensitivity: Scale1To5Schema.optional(),

  // NBA/NCAAB only
  trust_team_ratings: Scale1To5Schema.optional(),
  pace_affects_totals: z.boolean().optional(),

  // NBA only
  weight_recent_form: Scale1To5Schema.optional(),
  ride_hot_streaks: z.boolean().optional(),
  fade_cold_streaks: z.boolean().optional(),
  trust_ats_trends: z.boolean().optional(),
  regress_luck: z.boolean().optional(),

  // Situational
  home_court_boost: Scale1To5Schema,
  fade_back_to_backs: z.boolean().optional(),
  upset_alert: z.boolean().optional(),
});

export const CustomInsightsSchema = z.object({
  betting_philosophy: z.string().max(500).nullable(),
  perceived_edges: z.string().max(500).nullable(),
  avoid_situations: z.string().max(300).nullable(),
  target_situations: z.string().max(300).nullable(),
});

export const CreateAgentSchema = z.object({
  name: z.string().min(1).max(50),
  avatar_emoji: z.string().min(1).max(4),
  avatar_color: z.string().refine(
    (val) => /^#[0-9a-fA-F]{6}$/.test(val) || /^gradient:#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}$/.test(val),
    { message: 'Must be a hex color (#xxxxxx) or gradient (gradient:#xxxxxx,#xxxxxx)' }
  ),
  preferred_sports: z.array(z.enum(SPORTS)).min(1),
  archetype: z.enum(ARCHETYPE_IDS).nullable(),
  personality_params: PersonalityParamsSchema,
  custom_insights: CustomInsightsSchema,
  auto_generate: z.boolean().default(true),
});

export const UpdateAgentSchema = CreateAgentSchema.partial().extend({
  is_public: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// ============================================================================
// PICK GENERATION TYPES (for edge function)
// ============================================================================

export interface GeneratePicksRequest {
  avatar_id: string;
}

export interface GeneratedPick {
  game_id: string;
  bet_type: Exclude<BetType, 'any'>;
  selection: string;
  odds: string;
  confidence: Scale1To5;
  reasoning: string;
  key_factors: string[];
}

export interface GeneratePicksResponse {
  picks: GeneratedPick[];
  slate_note?: string;
}

export const GeneratedPickSchema = z.object({
  game_id: z.string(),
  bet_type: z.enum(['spread', 'moneyline', 'total']),
  selection: z.string(),
  odds: z.string(),
  confidence: Scale1To5Schema,
  reasoning: z.string().min(50).max(300),
  key_factors: z.array(z.string().min(10).max(100)).min(3).max(5),
});

export const GeneratePicksResponseSchema = z.object({
  picks: z.array(GeneratedPickSchema),
  slate_note: z.string().optional(),
});

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_PERSONALITY_PARAMS: PersonalityParams = {
  risk_tolerance: 3,
  underdog_lean: 3,
  over_under_lean: 3,
  confidence_threshold: 3,
  chase_value: false,
  preferred_bet_type: 'any',
  max_favorite_odds: -200,
  min_underdog_odds: null,
  max_picks_per_day: 3,
  skip_weak_slates: true,
  trust_model: 4,
  trust_polymarket: 3,
  polymarket_divergence_flag: true,
  home_court_boost: 3,
};

export const DEFAULT_CUSTOM_INSIGHTS: CustomInsights = {
  betting_philosophy: null,
  perceived_edges: null,
  avoid_situations: null,
  target_situations: null,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get parameters that should be shown based on selected sports
 */
export function getConditionalParams(sports: Sport[]): {
  showPublicBetting: boolean;
  showWeather: boolean;
  showTeamRatings: boolean;
  showTrends: boolean;
  showBackToBacks: boolean;
  showUpsetAlert: boolean;
} {
  const hasFootball = sports.includes('nfl') || sports.includes('cfb');
  const hasBasketball = sports.includes('nba') || sports.includes('ncaab');
  const hasNBA = sports.includes('nba');
  const hasNCAAB = sports.includes('ncaab');

  return {
    showPublicBetting: hasFootball,
    showWeather: hasFootball,
    showTeamRatings: hasBasketball,
    showTrends: hasNBA, // Only NBA has trend data
    showBackToBacks: hasBasketball,
    showUpsetAlert: hasNCAAB,
  };
}

/**
 * Format win-loss record as string
 */
export function formatRecord(perf: AgentPerformance | null): string {
  if (!perf) return '0-0';
  const parts = [perf.wins, perf.losses];
  if (perf.pushes > 0) parts.push(perf.pushes);
  return parts.join('-');
}

/**
 * Format net units with sign
 */
export function formatNetUnits(units: number): string {
  const sign = units >= 0 ? '+' : '';
  return `${sign}${units.toFixed(2)}u`;
}

/**
 * Format streak as string
 */
export function formatStreak(streak: number): string {
  if (streak === 0) return '-';
  if (streak > 0) return `W${streak}`;
  return `L${Math.abs(streak)}`;
}

/**
 * Calculate implied probability from American odds
 */
export function oddsToImpliedProb(odds: number): number {
  if (odds < 0) {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
  return 100 / (odds + 100);
}

/**
 * Calculate payout multiplier from American odds
 */
export function oddsToPayoutMultiplier(odds: number): number {
  if (odds < 0) {
    return 100 / Math.abs(odds);
  }
  return odds / 100;
}
