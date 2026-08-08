import { describe, expect, it } from 'vitest';
import type { TopAgentPickFeedRow } from '@/services/agentPicksService';
import type { Sport } from '@/types/agent';
import { buildOnboardingTeaserPreview, onboardingFixturePicks } from './onboardingTeaserPicks';

function row(id: string, sport: Sport): TopAgentPickFeedRow {
  return {
    id,
    avatar_id: `agent-${id}`,
    game_id: `game-${id}`,
    sport,
    matchup: `Away ${id} @ Home ${id}`,
    game_date: '2026-08-06',
    bet_type: 'spread',
    pick_selection: `Home ${id} -2.5`,
    odds: '-110',
    units: 1,
    confidence: 4,
    reasoning_text: 'Reasoning',
    key_factors: null,
    ai_decision_trace: null,
    ai_audit_payload: null,
    archived_game_data: {},
    archived_personality: {},
    result: 'pending',
    actual_result: null,
    graded_at: null,
    created_at: `2026-08-06T1${id}:00:00Z`,
    api_version: 'v2',
    agent_name: `Agent ${id}`,
    agent_avatar_emoji: '\u{1F916}',
    agent_avatar_color: '#22c55e',
    agent_wins: 10,
    agent_losses: 5,
    agent_pushes: 1,
    agent_net_units: 4.2,
    agent_rank: Number(id),
  } as TopAgentPickFeedRow;
}

describe('onboarding teaser selection', () => {
  const rows = [
    row('1', 'mlb'),
    row('2', 'nfl'),
    row('3', 'nba'),
    row('4', 'nfl'),
    row('5', 'cfb'),
  ];

  it('preserves feed order while selecting at most three matching sports', () => {
    const preview = buildOnboardingTeaserPreview(rows, ['nfl', 'cfb'], '2026-08-06');

    expect(preview.mode).toBe('live');
    expect(preview.matchingCandidateCount).toBe(3);
    expect(preview.picks.map((pick) => pick.id)).toEqual(['2', '4', '5']);
  });

  it('uses the central unfiltered pool when selected sports have no candidates', () => {
    const preview = buildOnboardingTeaserPreview(rows.slice(0, 2), ['ncaab'], '2026-08-06');

    expect(preview.mode).toBe('live-unfiltered-fallback');
    expect(preview.matchingCandidateCount).toBe(0);
    expect(preview.picks.map((pick) => pick.id)).toEqual(['1', '2']);
  });

  it('uses the newest three rows for the all-sports central preview', () => {
    const preview = buildOnboardingTeaserPreview(rows, [], '2026-08-06');

    expect(preview.picks.map((pick) => pick.id)).toEqual(['1', '2', '3']);
  });

  it('shows the exact three MLB fixtures when the live feed is empty', () => {
    const preview = buildOnboardingTeaserPreview([], ['mlb'], '2026-08-06');

    expect(preview.mode).toBe('fixture');
    expect(preview.picks).toEqual(onboardingFixturePicks(['mlb'], '2026-08-06'));
    expect(preview.picks.map((pick) => pick.selection)).toEqual([
      'Yankees ML',
      'Under 8.5',
      'Braves -1.5',
    ]);
  });
});
