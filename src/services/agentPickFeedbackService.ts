import { supabase } from '@/integrations/supabase/client';
import type { AgentParlay, AgentPick, AgentProfile } from '@/types/agent';

export type AgentPickFeedbackPlatform = 'web' | 'ios' | 'android';

export interface AgentPickFeedbackInput {
  userId: string;
  agent: AgentProfile;
  picks: AgentPick[];
  parlays: AgentParlay[];
  userDescription: string;
  platform?: AgentPickFeedbackPlatform;
}

function pickSnapshot(pick: AgentPick) {
  return {
    id: pick.id,
    kind: 'pick' as const,
    matchup: pick.matchup,
    selection: pick.pick_selection,
    bet_type: pick.bet_type,
    odds: pick.odds,
    units: pick.units,
    sport: pick.sport,
    game_date: pick.game_date,
    result: pick.result,
  };
}

function parlaySnapshot(parlay: AgentParlay) {
  return {
    id: parlay.id,
    kind: 'parlay' as const,
    matchup: (parlay.legs ?? []).map((leg) => leg.matchup).join(' + '),
    selection: `${parlay.legs_count}-leg parlay`,
    bet_type: 'parlay',
    odds: parlay.combined_odds,
    units: parlay.units,
    sport: parlay.sport,
    game_date: parlay.target_date ?? parlay.created_at.slice(0, 10),
    result: parlay.result,
  };
}

export async function submitAgentPickFeedback(input: AgentPickFeedbackInput): Promise<void> {
  const picksSnapshot = [
    ...input.picks.slice(0, 20).map(pickSnapshot),
    ...input.parlays.slice(0, 10).map(parlaySnapshot),
  ];

  const { error } = await (supabase as any).from('agent_pick_feedback').insert({
    user_id: input.userId,
    agent_id: input.agent.id,
    agent_name: input.agent.name,
    user_description: input.userDescription,
    picks_snapshot: picksSnapshot,
    agent_snapshot: {
      name: input.agent.name,
      avatar_emoji: input.agent.avatar_emoji,
      preferred_sports: input.agent.preferred_sports,
      archetype: input.agent.archetype,
    },
    platform: input.platform ?? 'web',
  });

  if (error) throw error;
}
