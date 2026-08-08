import type { TopAgentPickFeedRow } from '@/services/agentPicksService';
import type { Sport } from '@/types/agent';

export const ONBOARDING_TEASER_FEED_LIMIT = 40;
export const ONBOARDING_TEASER_PICK_LIMIT = 3;

export const ONBOARDING_SPORT_OPTIONS: Array<{ value: Sport; label: string }> = [
  { value: 'nfl', label: 'NFL' },
  { value: 'cfb', label: 'CFB' },
  { value: 'nba', label: 'NBA' },
  { value: 'ncaab', label: 'CBB' },
  { value: 'mlb', label: 'MLB' },
];

export type OnboardingTeaserSource = 'live' | 'fixture';
export type OnboardingTeaserMode = 'live' | 'live-unfiltered-fallback' | 'fixture';

export interface OnboardingTeaserPick {
  id: string;
  sport: Sport;
  matchup: string;
  gameDate: string;
  betType: string;
  selection: string;
  odds: string | null;
  units: number;
  confidence: number;
  createdAt: string | null;
  agentId: string | null;
  agentName: string;
  agentEmoji: string;
  agentColor: string;
  agentRank: number | null;
  source: OnboardingTeaserSource;
}

export interface OnboardingTeaserPreview {
  picks: OnboardingTeaserPick[];
  mode: OnboardingTeaserMode;
  matchingCandidateCount: number;
}

function livePreviewPick(row: TopAgentPickFeedRow): OnboardingTeaserPick {
  return {
    id: row.id,
    sport: row.sport,
    matchup: row.matchup,
    gameDate: row.game_date,
    betType: row.bet_type,
    selection: row.pick_selection,
    odds: row.odds,
    units: Number(row.units ?? 0),
    confidence: Number(row.confidence ?? 0),
    createdAt: row.created_at,
    agentId: row.avatar_id,
    agentName: row.agent_name,
    agentEmoji: row.agent_avatar_emoji || '\u{1F916}',
    agentColor: row.agent_avatar_color || '#22c55e',
    agentRank: row.agent_rank,
    source: 'live',
  };
}

function fixturePick(
  index: number,
  sport: Sport,
  matchup: string,
  betType: string,
  selection: string,
  odds: string,
  confidence: number,
  todayEt: string,
): OnboardingTeaserPick {
  return {
    id: `onboarding-fixture-${index}`,
    sport,
    matchup,
    gameDate: todayEt,
    betType,
    selection,
    odds,
    units: 1,
    confidence,
    createdAt: null,
    agentId: null,
    agentName: 'Bundled fallback',
    agentEmoji: '\u{1F4E6}',
    agentColor: '#22c55e',
    agentRank: null,
    source: 'fixture',
  };
}

/**
 * Mirrors `OnboardingGenesisModel.fixturePicks` in the native iOS app. Keeping
 * the fallback visible here is intentional: an empty or unreachable live feed
 * must not make the admin preview look like onboarding would show no tickets.
 */
export function onboardingFixturePicks(selectedSports: readonly Sport[], todayEt: string): OnboardingTeaserPick[] {
  const sports = new Set(selectedSports);

  if (sports.size === 1 && sports.has('mlb')) {
    return [
      fixturePick(0, 'mlb', 'Yankees @ Red Sox', 'moneyline', 'Yankees ML', '-125', 4, todayEt),
      fixturePick(1, 'mlb', 'Dodgers @ Giants', 'total', 'Under 8.5', '-110', 3, todayEt),
      fixturePick(2, 'mlb', 'Braves @ Phillies', 'run line', 'Braves -1.5', '+135', 3, todayEt),
    ];
  }

  const picks: OnboardingTeaserPick[] = [];
  if (sports.size === 0 || sports.has('nfl') || sports.has('cfb')) {
    picks.push(fixturePick(0, 'nfl', 'Chiefs @ Bills', 'spread', 'Bills +2.5', '-110', 4, todayEt));
  }
  if (sports.size === 0 || sports.has('nba') || sports.has('ncaab')) {
    picks.push(fixturePick(1, 'nba', 'Lakers @ Celtics', 'total', 'Over 224.5', '-108', 3, todayEt));
  }
  picks.push(fixturePick(2, 'nfl', 'Cowboys @ Eagles', 'moneyline', 'Eagles ML', '-135', 4, todayEt));
  return picks.slice(0, ONBOARDING_TEASER_PICK_LIMIT);
}

/**
 * Exact native onboarding choice rule:
 * 1. preserve the RPC's newest-first ordering;
 * 2. prefer rows in any sport the new agent selected;
 * 3. if that subset is empty, use the unfiltered pool;
 * 4. take at most three; use bundled fixtures only when the pool is empty.
 */
export function buildOnboardingTeaserPreview(
  rows: readonly TopAgentPickFeedRow[],
  selectedSports: readonly Sport[],
  todayEt: string,
): OnboardingTeaserPreview {
  if (rows.length === 0) {
    return {
      picks: onboardingFixturePicks(selectedSports, todayEt),
      mode: 'fixture',
      matchingCandidateCount: 0,
    };
  }

  const sports = new Set(selectedSports);
  const matching = sports.size === 0 ? [...rows] : rows.filter((row) => sports.has(row.sport));
  const usedUnfilteredFallback = matching.length === 0;
  const source = usedUnfilteredFallback ? rows : matching;

  return {
    picks: source.slice(0, ONBOARDING_TEASER_PICK_LIMIT).map(livePreviewPick),
    mode: usedUnfilteredFallback ? 'live-unfiltered-fallback' : 'live',
    matchingCandidateCount: matching.length,
  };
}
