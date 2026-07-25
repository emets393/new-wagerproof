/**
 * Onboarding flow definition — a web port of the iOS native onboarding
 * (OnboardingPageSpec.swift + OnboardingStore.swift). The step order, CTA
 * titles, gating and the persisted onboarding_data shape all mirror iOS so
 * the two clients stay in lockstep. The one iOS-only step (ATT priming) is
 * intentionally omitted on web.
 */
import type { ArchetypeId, CustomInsights, PersonalityParams, Sport } from '@/types/agent';
import { DEFAULT_CUSTOM_INSIGHTS, DEFAULT_PERSONALITY_PARAMS } from '@/types/agent';
import type { ResearchTimeBucket, StakesBucket } from './research';

export const CAROUSEL_STEPS = [
  'terms',
  'bettorType',
  'bettingPitfalls',
  'acquisitionSource',
  'primaryGoal',
  'researchTime',
  'weeklyStakes',
  'researchCost',
  'researchReclaim',
  'agentHQ',
  'agentValueIntro',
  'agentValueProof',
  'agentLeaderboard',
  'builderSports',
  'builderArchetype',
  'builderMindset',
  'builderBetStyle',
  'builderDataTrust',
  'builderSportRules',
  'builderInsights',
  'builderIdentity',
] as const;

export const CINEMATIC_STEPS = ['generation', 'reveal', 'timeSummary'] as const;

export const ONBOARDING_STEPS = [...CAROUSEL_STEPS, ...CINEMATIC_STEPS, 'paywall'] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];
export type CarouselStepId = (typeof CAROUSEL_STEPS)[number];

export const CAROUSEL_STEP_COUNT = CAROUSEL_STEPS.length;

export function isCarouselStep(step: OnboardingStepId): step is CarouselStepId {
  return (CAROUSEL_STEPS as readonly string[]).includes(step);
}

/** CTA title shown in the shared chrome for each carousel step. */
export const STEP_CTA_TITLES: Record<CarouselStepId, string> = {
  terms: 'I agree — continue',
  bettorType: 'Continue',
  bettingPitfalls: 'Continue',
  acquisitionSource: 'Continue',
  primaryGoal: 'Continue',
  researchTime: 'Continue',
  weeklyStakes: 'Continue',
  researchCost: 'Fix this',
  researchReclaim: 'Show me how',
  agentHQ: 'Continue',
  agentValueIntro: 'Continue',
  agentValueProof: 'Continue',
  agentLeaderboard: 'Continue',
  builderSports: 'Continue',
  builderArchetype: 'Continue',
  builderMindset: 'Continue',
  builderBetStyle: 'Continue',
  builderDataTrust: 'Continue',
  builderSportRules: 'Continue',
  builderInsights: 'Continue',
  builderIdentity: 'Create my agent',
};

export const AGENT_PITCH_SLIDE_COUNT = 3;

export type BettorType = 'casual' | 'serious' | 'professional';

export const BETTOR_TYPE_OPTIONS: { value: BettorType; label: string; detail: string }[] = [
  { value: 'casual', label: 'Casual', detail: 'I bet for fun and want quick, trustworthy reads' },
  { value: 'serious', label: 'Serious', detail: 'I research lines and trends before I play' },
  { value: 'professional', label: 'Professional', detail: 'I track units, ROI, and closing-line value' },
];

/** Accent color per bettor type — mirrors OnboardingTheme.swift. */
export const BETTOR_TYPE_ACCENTS: Record<BettorType, string> = {
  casual: '#22c55e',
  serious: '#3b82f6',
  professional: '#8b5cf6',
};

export const DEFAULT_ACCENT = '#22c55e';

export const BETTING_PITFALLS = [
  'Chasing Losses',
  'Tilt Betting',
  'Too Many Parlays',
  'No Bankroll Plan',
  'FOMO Bets',
  'Team Bias',
  'Ignoring Odds',
  'Overbetting',
  'Skipping Research',
  'Emotional Bets',
  'Chalk Only',
  'Missed Injuries',
] as const;

export const ACQUISITION_SOURCES = [
  'TikTok',
  'X / Twitter',
  'YouTube',
  'Google',
  'Friend / Referral',
  'Other',
] as const;

export const PRIMARY_GOALS = [
  'Find profitable edges faster',
  'Analyze data to improve strategy',
  'Track my performance over time',
  'Get timely alerts for model picks',
] as const;

export interface OnboardingSurvey {
  favoriteSports: string[];
  bettingPitfalls: string[];
  bettorType?: BettorType;
  mainGoal?: string;
  acquisitionSource?: string;
  termsAcceptedAt?: string;
  overEighteenAttested?: boolean;
  researchTimeBucket?: ResearchTimeBucket;
  weeklyStakesBucket?: StakesBucket;
}

export const EMPTY_SURVEY: OnboardingSurvey = {
  favoriteSports: [],
  bettingPitfalls: [],
};

export const AGENT_NAME_MAX_LENGTH = 50;
export const DEFAULT_AVATAR_EMOJI = '🤖';
export const DEFAULT_AVATAR_COLOR = 'gradient:#6366f1,#ec4899';

/** The 16 identity color gradients — mirrors OnboardingBuilderIdentityPage. */
export const AVATAR_COLOR_OPTIONS = [
  'gradient:#6366f1,#ec4899',
  'gradient:#8b5cf6,#06b6d4',
  'gradient:#ef4444,#f97316',
  'gradient:#22c55e,#06b6d4',
  'gradient:#f97316,#eab308',
  'gradient:#ec4899,#8b5cf6',
  'gradient:#06b6d4,#6366f1',
  'gradient:#22c55e,#eab308',
  'gradient:#ef4444,#ec4899',
  'gradient:#8b5cf6,#f97316',
  'gradient:#3b82f6,#22c55e',
  'gradient:#f59e0b,#ef4444',
  'gradient:#14b8a6,#8b5cf6',
  'gradient:#6366f1,#3b82f6',
  'gradient:#dc2626,#7c3aed',
  'gradient:#0ea5e9,#22d3ee',
] as const;

export const SPRITE_COUNT = 8;

export const SPORT_OPTIONS: { value: Sport; label: string }[] = [
  { value: 'nfl', label: 'NFL' },
  { value: 'cfb', label: 'CFB' },
  { value: 'nba', label: 'NBA' },
  { value: 'ncaab', label: 'NCAAB' },
  { value: 'mlb', label: 'MLB' },
];

export interface AgentDraft {
  preferred_sports: Sport[];
  archetype: ArchetypeId | null;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
  sprite_index: number | null;
  personality_params: PersonalityParams;
  custom_insights: CustomInsights;
}

export const EMPTY_AGENT_DRAFT: AgentDraft = {
  preferred_sports: [],
  archetype: null,
  name: '',
  avatar_emoji: DEFAULT_AVATAR_EMOJI,
  avatar_color: DEFAULT_AVATAR_COLOR,
  sprite_index: null,
  personality_params: { ...DEFAULT_PERSONALITY_PARAMS },
  custom_insights: { ...DEFAULT_CUSTOM_INSIGHTS },
};

/** The profiles.onboarding_data payload — same shape iOS writes on markComplete. */
export function buildOnboardingData(survey: OnboardingSurvey, draft: AgentDraft) {
  return {
    favoriteSports: survey.favoriteSports,
    bettingPitfalls: survey.bettingPitfalls,
    bettorType: survey.bettorType,
    mainGoal: survey.mainGoal,
    acquisitionSource: survey.acquisitionSource,
    termsAcceptedAt: survey.termsAcceptedAt,
    overEighteenAttested: survey.overEighteenAttested,
    researchTimeBucket: survey.researchTimeBucket,
    weeklyStakesBucket: survey.weeklyStakesBucket,
    agentFormState: {
      preferred_sports: draft.preferred_sports,
      archetype: draft.archetype,
      name: draft.name,
      avatar_emoji: draft.avatar_emoji,
      avatar_color: draft.avatar_color,
      sprite_index: draft.sprite_index,
      personality_params: draft.personality_params,
      custom_insights: draft.custom_insights,
      auto_generate: true,
      auto_generate_time: '09:00',
      auto_generate_timezone: 'America/New_York',
    },
  };
}

/** Discrete 1–5 slider labels (mirror OnboardingPersonalityPages). */
export const SLIDER_LABELS = {
  risk_tolerance: ['Very Safe', 'Conservative', 'Balanced', 'Aggressive', 'High Risk'],
  underdog_lean: ['Chalk Only', 'Prefer Favs', 'Balanced', 'Prefer Dogs', 'Dogs Only'],
  over_under_lean: ['Unders Only', 'Prefer Under', 'Balanced', 'Prefer Over', 'Overs Only'],
  confidence_threshold: ['Any Edge', 'Low Bar', 'Moderate', 'High Bar', 'Very Picky'],
  parlay_appetite: ['Straights Only', 'Rarely', 'Sometimes', 'Often', 'Loves Parlays'],
  max_picks_per_day: ['1 Pick', '2 Picks', '3 Picks', '4 Picks', '5 Picks'],
  trust: ['Ignore', 'Low Trust', 'Moderate', 'High Trust', 'Full Trust'],
  home_court_boost: ['Ignore', 'Slight', 'Moderate', 'Strong', 'Maximum'],
  public_threshold: ['55%', '60%', '65%', '70%', '75%'],
  weather_sensitivity: ['Minimal', 'Light', 'Moderate', 'Heavy', 'Maximum'],
  weight_recent_form: ['Ignore', 'Light', 'Moderate', 'Heavy', 'Primary'],
} as const;
