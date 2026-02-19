import { z } from 'zod';

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

export type Scale1To5 = 1 | 2 | 3 | 4 | 5;

export interface PersonalityParams {
  risk_tolerance: Scale1To5;
  underdog_lean: Scale1To5;
  over_under_lean: Scale1To5;
  confidence_threshold: Scale1To5;
  chase_value: boolean;

  preferred_bet_type: BetType;
  max_favorite_odds: number | null;
  min_underdog_odds: number | null;
  max_picks_per_day: Scale1To5;
  skip_weak_slates: boolean;

  trust_model: Scale1To5;
  trust_polymarket: Scale1To5;
  polymarket_divergence_flag: boolean;

  fade_public?: boolean;
  public_threshold?: Scale1To5;
  weather_impacts_totals?: boolean;
  weather_sensitivity?: Scale1To5;

  trust_team_ratings?: Scale1To5;
  pace_affects_totals?: boolean;

  weight_recent_form?: Scale1To5;
  ride_hot_streaks?: boolean;
  fade_cold_streaks?: boolean;
  trust_ats_trends?: boolean;
  regress_luck?: boolean;

  home_court_boost: Scale1To5;
  fade_back_to_backs?: boolean;
  upset_alert?: boolean;
}

export interface CustomInsights {
  betting_philosophy: string | null;
  perceived_edges: string | null;
  avoid_situations: string | null;
  target_situations: string | null;
}

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
  is_widget_favorite: boolean;
  last_generated_at: string | null;
  last_auto_generated_at: string | null;
  owner_last_active_at: string | null;
  daily_generation_count: number;
  last_generation_date: string | null;
}

export interface AgentUsedMetric {
  metric_key: string;
  metric_value: string;
  why_it_mattered: string;
  personality_trait: string;
  weight?: number;
}

export interface AgentDecisionTrace {
  leaned_metrics: AgentUsedMetric[];
  rationale_summary: string;
  personality_alignment: string;
  other_metrics_considered?: string[];
}

export interface AgentPick {
  id: string;
  avatar_id: string;
  game_id: string;
  sport: Sport;
  matchup: string;
  game_date: string;
  bet_type: Exclude<BetType, 'any'>;
  pick_selection: string;
  odds: string | null;
  units: number;
  confidence: Scale1To5;
  reasoning_text: string;
  key_factors: string[] | null;
  ai_decision_trace: AgentDecisionTrace | null;
  ai_audit_payload: Record<string, unknown> | null;
  archived_game_data: Record<string, unknown>;
  archived_personality: PersonalityParams;
  result: PickResult;
  actual_result: string | null;
  graded_at: string | null;
  created_at: string;
}

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

export interface AgentWithPerformance extends AgentProfile {
  performance: AgentPerformance | null;
}

const Scale1To5Schema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const PersonalityParamsSchema = z.object({
  risk_tolerance: Scale1To5Schema,
  underdog_lean: Scale1To5Schema,
  over_under_lean: Scale1To5Schema,
  confidence_threshold: Scale1To5Schema,
  chase_value: z.boolean(),

  preferred_bet_type: z.enum(BET_TYPES),
  max_favorite_odds: z.number().max(-100).nullable(),
  min_underdog_odds: z.number().min(100).nullable(),
  max_picks_per_day: Scale1To5Schema,
  skip_weak_slates: z.boolean(),

  trust_model: Scale1To5Schema,
  trust_polymarket: Scale1To5Schema,
  polymarket_divergence_flag: z.boolean(),

  fade_public: z.boolean().optional(),
  public_threshold: Scale1To5Schema.optional(),
  weather_impacts_totals: z.boolean().optional(),
  weather_sensitivity: Scale1To5Schema.optional(),

  trust_team_ratings: Scale1To5Schema.optional(),
  pace_affects_totals: z.boolean().optional(),

  weight_recent_form: Scale1To5Schema.optional(),
  ride_hot_streaks: z.boolean().optional(),
  fade_cold_streaks: z.boolean().optional(),
  trust_ats_trends: z.boolean().optional(),
  regress_luck: z.boolean().optional(),

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
  avatar_emoji: z.string().min(1).max(8),
  avatar_color: z.string().refine(
    (val) => /^#[0-9a-fA-F]{6}$/.test(val) || /^gradient:#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}$/.test(val),
    { message: 'Must be hex (#xxxxxx) or gradient (gradient:#xxxxxx,#xxxxxx)' }
  ),
  preferred_sports: z.array(z.enum(SPORTS)).min(1),
  archetype: z.enum(ARCHETYPE_IDS).nullable(),
  personality_params: PersonalityParamsSchema,
  custom_insights: CustomInsightsSchema,
  auto_generate: z.boolean().default(true),
  is_widget_favorite: z.boolean().default(false),
});

export const UpdateAgentSchema = CreateAgentSchema.partial().extend({
  is_public: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export type CreateAgentInput = z.input<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.input<typeof UpdateAgentSchema>;

export interface GeneratedPick {
  game_id: string;
  bet_type: Exclude<BetType, 'any'>;
  selection: string;
  odds: string;
  confidence: Scale1To5;
  reasoning: string;
  key_factors: string[];
  decision_trace?: AgentDecisionTrace;
}

export interface GeneratePicksResponse {
  picks: GeneratedPick[];
  slate_note?: string;
}

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

export interface CreateAgentFormState {
  preferred_sports: Sport[];
  archetype: ArchetypeId | null;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  personality_params: PersonalityParams;
  custom_insights: CustomInsights;
  auto_generate: boolean;
}

export const INITIAL_FORM_STATE: CreateAgentFormState = {
  preferred_sports: [],
  archetype: null,
  name: '',
  avatar_emoji: '',
  avatar_color: '#6366f1',
  personality_params: { ...DEFAULT_PERSONALITY_PARAMS },
  custom_insights: { ...DEFAULT_CUSTOM_INSIGHTS },
  auto_generate: true,
};

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
    showTrends: hasNBA,
    showBackToBacks: hasBasketball,
    showUpsetAlert: hasNCAAB,
  };
}

export function formatRecord(perf: AgentPerformance | null): string {
  if (!perf) return '0-0';
  const parts = [perf.wins, perf.losses];
  if (perf.pushes > 0) parts.push(perf.pushes);
  return parts.join('-');
}

export function formatNetUnits(units: number): string {
  const sign = units >= 0 ? '+' : '';
  return `${sign}${units.toFixed(2)}u`;
}

export function formatStreak(streak: number): string {
  if (streak === 0) return '-';
  if (streak > 0) return `W${streak}`;
  return `L${Math.abs(streak)}`;
}
