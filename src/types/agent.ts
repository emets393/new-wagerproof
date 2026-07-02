import { z } from 'zod';

function countVisibleCharacters(value: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].length;
  }

  return Array.from(value.replace(/\uFE0F/g, '')).length;
}

const EmojiSchema = z.string().min(1).refine(
  (value) => countVisibleCharacters(value) <= 4,
  { message: 'Emoji must be 4 visible characters or fewer' }
);

export const SPORTS = ['nfl', 'cfb', 'nba', 'ncaab', 'mlb'] as const;
export type Sport = (typeof SPORTS)[number];

// An agent may only cover sports within a single family. Football and basketball
// each pair their pro/college sports; baseball stands alone. Mixing families is
// disallowed because each sport family routes to its own large system prompt +
// data payload (see AGENT_PAYLOAD_SPEC.md), and a single agent maps to one prompt.
export const SPORT_FAMILIES = {
  football: ['nfl', 'cfb'],
  basketball: ['nba', 'ncaab'],
  baseball: ['mlb'],
} as const satisfies Record<string, readonly Sport[]>;

export type SportFamily = keyof typeof SPORT_FAMILIES;

export function sportFamily(sport: Sport): SportFamily {
  if ((SPORT_FAMILIES.football as readonly Sport[]).includes(sport)) return 'football';
  if ((SPORT_FAMILIES.basketball as readonly Sport[]).includes(sport)) return 'basketball';
  return 'baseball';
}

export function isSingleSportFamily(sports: Sport[]): boolean {
  if (sports.length === 0) return true;
  const fam = sportFamily(sports[0]);
  return sports.every((s) => sportFamily(s) === fam);
}

// Pure toggle used by every sport-picker: purely additive — any sport can be
// added to any selection. Cross-family agents are allowed and run on the V3
// engine (see .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md); the old
// same-family reset has been removed.
export function toggleSportSelection(selected: Sport[], sport: Sport): Sport[] {
  if (selected.includes(sport)) {
    return selected.filter((s) => s !== sport);
  }
  return [...selected, sport];
}

export const BET_TYPES = ['spread', 'moneyline', 'total', 'any'] as const;
export type BetType = (typeof BET_TYPES)[number];

// ── V3 market allowlist + new dials. These back the OPTIONAL/additive fields on
//    PersonalityParams below — V2 creations omit them, so live agent creation is
//    unaffected. Source of truth for the create-agent form is the LOCKED CONTRACT
//    in .claude/docs/agents/15_V3_PERSONALITY_QUESTIONS.md. ───────────────────────
export const MARKET_KEYS = [
  'fg_ml', 'fg_spread', 'fg_total', 'h1_ml', 'h1_spread', 'h1_total',
  'f5_ml', 'f5_spread', 'f5_total', 'team_total', 'prop',
] as const;
export type MarketKey = (typeof MARKET_KEYS)[number];
/** Per-sport market allowlist: which markets the agent may bet for each selected sport. */
export type AllowedMarkets = Partial<Record<Sport, MarketKey[]>>;
export const LINE_TIMINGS = ['early', 'balanced', 'late'] as const; // NFL/CFB only
export type LineTiming = (typeof LINE_TIMINGS)[number];
export const STAKING_STYLES = ['flat', 'scaled'] as const;
export type StakingStyle = (typeof STAKING_STYLES)[number];

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
  parlay_appetite?: Scale1To5;  // 1 = straights only, 5 = loves parlays (always-on, not sport-gated)
  parlays_only?: boolean;       // force every play into parlay tickets (V3 engine rejects straights)

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

  // ── V3 personality (OPTIONAL — additive; consumed when V3 ships, ignored by V2.
  //    LOCKED CONTRACT: .claude/docs/agents/15_V3_PERSONALITY_QUESTIONS.md) ─────────
  allowed_markets?: AllowedMarkets;   // per-sport market allowlist (supersedes preferred_bet_type in V3)
  trust_signals?: Scale1To5;          // lean on validated signals (get_signals)
  public_lean?: Scale1To5;            // public betting fade↔follow (supersedes fade_public + public_threshold)
  respect_line_movement?: Scale1To5;  // respect line movement / sharp money (get_line_movement)
  line_timing?: LineTiming;           // NFL/CFB ONLY — openers (early) ↔ wait for movement (late)
  staking_style?: StakingStyle;       // flat units ↔ scaled by conviction
  parlays_enabled?: boolean;          // V3 parlay toggle (supersedes parlay_appetite)
  max_parlay_legs?: 2 | 3 | 4;        // leg cap when parlays_enabled
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
  auto_generate_time: string;
  auto_generate_timezone: string;
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

export interface OverlapAgentSummary {
  avatar_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
}

export interface AgentPickOverlap {
  totalCount: number;
  agents: OverlapAgentSummary[];
}

export interface AgentPick {
  id: string;
  avatar_id: string;
  game_id: string;
  sport: Sport;
  matchup: string;
  game_date: string;
  bet_type: Exclude<BetType, 'any'>;
  period?: 'full' | 'f5' | null;
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
  overlap?: AgentPickOverlap;
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
  parlay_appetite: Scale1To5Schema.optional(),  // 1 = straights only, 5 = loves parlays
  parlays_only: z.boolean().optional(),         // force every play into parlay tickets (V3 engine rejects straights)

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

  // ── V3 (OPTIONAL — additive; absent on V2 creations, so live production keeps
  //    validating unchanged). LOCKED CONTRACT — 15_V3_PERSONALITY_QUESTIONS.md. ────
  // Explicit per-sport object + .partial() so an agent may set markets for ONLY its
  // sports (NFL-only → { nfl: [...] }) while the sport keys + market values stay
  // validated. .partial() makes every sport key optional (the Partial<Record> shape).
  allowed_markets: z.object({
    nfl: z.array(z.enum(MARKET_KEYS)),
    cfb: z.array(z.enum(MARKET_KEYS)),
    nba: z.array(z.enum(MARKET_KEYS)),
    ncaab: z.array(z.enum(MARKET_KEYS)),
    mlb: z.array(z.enum(MARKET_KEYS)),
  }).partial().optional(),
  trust_signals: Scale1To5Schema.optional(),
  public_lean: Scale1To5Schema.optional(),
  respect_line_movement: Scale1To5Schema.optional(),
  line_timing: z.enum(LINE_TIMINGS).optional(),
  staking_style: z.enum(STAKING_STYLES).optional(),
  // Dead fields — no engine reads these; the live V3 knobs are parlay_appetite
  // + parlays_only above. Kept so old rows still parse.
  parlays_enabled: z.boolean().optional(),
  max_parlay_legs: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

export const CustomInsightsSchema = z.object({
  betting_philosophy: z.string().max(500).nullable(),
  perceived_edges: z.string().max(500).nullable(),
  avoid_situations: z.string().max(300).nullable(),
  target_situations: z.string().max(300).nullable(),
});

export const CreateAgentSchema = z.object({
  name: z.string().min(1).max(50),
  avatar_emoji: EmojiSchema,
  avatar_color: z.string().refine(
    (val) => /^#[0-9a-fA-F]{6}$/.test(val) || /^gradient:#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}$/.test(val),
    { message: 'Must be hex (#xxxxxx) or gradient (gradient:#xxxxxx,#xxxxxx)' }
  ),
  // Cross-family selections are allowed — they run on the V3 engine (the
  // single-family refine was removed). isSingleSportFamily is kept as a soft UI
  // signal. See .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md.
  preferred_sports: z.array(z.enum(SPORTS)).min(1),
  archetype: z.enum(ARCHETYPE_IDS).nullable(),
  personality_params: PersonalityParamsSchema,
  custom_insights: CustomInsightsSchema,
  auto_generate: z.boolean().default(true),
  auto_generate_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('09:00'),
  auto_generate_timezone: z.string().default('America/New_York'),
  is_widget_favorite: z.boolean().default(false),
});

export const UpdateAgentSchema = CreateAgentSchema.partial().extend({
  is_public: z.boolean().optional(),
  is_active: z.boolean().optional(),
  // No family constraint: cross-family agents are now allowed (they run on the
  // V3 engine — see .claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md), which also
  // grandfathers legacy mixed agents whose preferred_sports predate the old rule.
  preferred_sports: z.array(z.enum(SPORTS)).min(1).optional(),
});

export type CreateAgentInput = z.input<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.input<typeof UpdateAgentSchema>;

export interface GeneratedPick {
  game_id: string;
  bet_type: Exclude<BetType, 'any'>;
  period?: 'full' | 'f5';
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
  picks_generated: number;
}

export const DEFAULT_PERSONALITY_PARAMS: PersonalityParams = {
  risk_tolerance: 3,
  underdog_lean: 3,
  over_under_lean: 3,
  confidence_threshold: 3,
  chase_value: false,
  parlay_appetite: 1,  // conservative default — straights only until the user dials it up
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
  auto_generate_time: string;
  auto_generate_timezone: string;
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
  auto_generate_time: '09:00',
  auto_generate_timezone: 'America/New_York',
};

export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
] as const;

export function getTimezoneLabel(tz: string): string {
  return US_TIMEZONES.find((t) => t.value === tz)?.label || 'Eastern (ET)';
}

export function getTimezoneAbbr(tz: string): string {
  const label = getTimezoneLabel(tz);
  const match = label.match(/\(([^)]+)\)/);
  return match ? match[1] : 'ET';
}

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
  const hasMLB = sports.includes('mlb');

  return {
    showPublicBetting: hasFootball,
    showWeather: hasFootball || hasMLB,
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
