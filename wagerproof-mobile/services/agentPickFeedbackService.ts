import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { AgentPick, AgentProfile } from '@/types/agent';

export interface AgentPickFeedbackInput {
  userId: string;
  agent: AgentProfile;
  picks: AgentPick[];
  userDescription: string;
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

export async function submitAgentPickFeedback(input: AgentPickFeedbackInput): Promise<void> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const { error } = await (supabase as any).from('agent_pick_feedback').insert({
    user_id: input.userId,
    agent_id: input.agent.id,
    agent_name: input.agent.name,
    user_description: input.userDescription,
    picks_snapshot: input.picks.slice(0, 25).map(pickSnapshot),
    agent_snapshot: {
      name: input.agent.name,
      avatar_emoji: input.agent.avatar_emoji,
      preferred_sports: input.agent.preferred_sports,
      archetype: input.agent.archetype,
    },
    platform,
  });

  if (error) throw error;
}
