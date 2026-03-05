import { supabase } from './supabase';

export interface AgentV2Flags {
  agents_v2_leaderboard_enabled: boolean;
  agents_v2_top_picks_enabled: boolean;
  agents_v2_agent_detail_enabled: boolean;
  agents_v2_shadow_compare_enabled: boolean;
}

const DEFAULT_FLAGS: AgentV2Flags = {
  agents_v2_leaderboard_enabled: false,
  agents_v2_top_picks_enabled: false,
  agents_v2_agent_detail_enabled: false,
  agents_v2_shadow_compare_enabled: false,
};

const FLAG_KEYS = Object.keys(DEFAULT_FLAGS);

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

export async function fetchAgentV2Flags(): Promise<AgentV2Flags> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', FLAG_KEYS);

    if (error) {
      console.warn('Failed to load agent v2 flags, defaulting to legacy paths:', error.message);
      return DEFAULT_FLAGS;
    }

    const next: AgentV2Flags = { ...DEFAULT_FLAGS };

    for (const row of data || []) {
      const key = row.setting_key as keyof AgentV2Flags;
      if (!(key in next)) continue;
      const payload = row.setting_value as Record<string, unknown> | null;
      next[key] = toBool(payload?.enabled);
    }

    return next;
  } catch (error) {
    console.warn('Unexpected error loading agent v2 flags, using defaults:', error);
    return DEFAULT_FLAGS;
  }
}

export { DEFAULT_FLAGS as defaultAgentV2Flags };
