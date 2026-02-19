import { supabase } from '@/integrations/supabase/client';
import { AgentPick, PickResult, Sport, GeneratePicksResponse } from '@/types/agent';

export interface AgentPicksFilters {
  sport?: Sport;
  result?: PickResult;
}

export async function fetchAgentPicks(agentId: string, filters?: AgentPicksFilters): Promise<AgentPick[]> {
  let query = (supabase as any)
    .from('avatar_picks')
    .select('*')
    .eq('avatar_id', agentId)
    .order('game_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.sport) query = query.eq('sport', filters.sport);
  if (filters?.result) query = query.eq('result', filters.result);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AgentPick[];
}

export async function generatePicks(agentId: string, isAdmin = false): Promise<GeneratePicksResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error('User not authenticated');

  const functionUrl = 'https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/generate-avatar-picks';
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      avatar_id: agentId,
      user_id: session.user.id,
      is_admin: isAdmin,
    }),
  });

  const responseBody = await response.json();

  if (!response.ok || !responseBody?.success) {
    throw new Error(responseBody?.error || `Pick generation failed (${response.status})`);
  }

  return {
    picks: responseBody.picks || [],
    slate_note: responseBody.slate_note,
  };
}
