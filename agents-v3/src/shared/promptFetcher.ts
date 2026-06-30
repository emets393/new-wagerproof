// =============================================================================
// Shared Prompt Fetcher
// Fetches sport-specific or default system prompt from agent_system_prompts table.
// Used by generate-avatar-picks, auto-generate-avatar-picks, and
// process-agent-generation-job-v2.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePromptSport } from './sportFamily';

export interface FetchedPrompt {
  remotePromptTemplate: string | null;
  systemPromptVersion: string;
}

/**
 * Fetches the active system prompt, preferring a sport-specific prompt for
 * single-sport agents. Falls back to the default (sport=null) prompt.
 *
 * @param client - Supabase client (service role)
 * @param preferredSports - The agent's preferred_sports array
 * @param logPrefix - Logging prefix for the calling function
 */
export async function fetchActiveSystemPrompt(
  client: SupabaseClient,
  preferredSports: string[],
  logPrefix: string = '[prompt-fetcher]'
): Promise<FetchedPrompt> {
  let remotePromptTemplate: string | null = null;
  let systemPromptVersion = 'hardcoded_fallback';

  // Resolve which sport-specific prompt this agent should use. Football-only
  // agents (nfl and/or cfb) map to the 'nfl' row (v1_nfl serves both); single
  // non-football sports map to themselves; mixed/multi-family → null (default).
  const promptSport = resolvePromptSport(preferredSports);
  if (promptSport) {
    const { data: sportPromptRow } = await client
      .from('agent_system_prompts')
      .select('id, prompt_text')
      .eq('is_active', true)
      .eq('sport', promptSport)
      .single();

    if (sportPromptRow) {
      remotePromptTemplate = sportPromptRow.prompt_text;
      systemPromptVersion = String(sportPromptRow.id || 'unknown');
      console.log(`${logPrefix} Loaded sport-specific system prompt: ${systemPromptVersion} (sport=${promptSport})`);
      return { remotePromptTemplate, systemPromptVersion };
    }
  }

  // Fall back to default prompt (sport IS NULL)
  const { data: promptRow, error: promptError } = await client
    .from('agent_system_prompts')
    .select('id, prompt_text')
    .eq('is_active', true)
    .is('sport', null)
    .single();

  if (promptError || !promptRow) {
    console.warn(`${logPrefix} No active system prompt found, using hardcoded fallback`);
  } else {
    remotePromptTemplate = promptRow.prompt_text;
    systemPromptVersion = String(promptRow.id || 'unknown');
    console.log(`${logPrefix} Loaded default system prompt: ${systemPromptVersion}`);
  }

  return { remotePromptTemplate, systemPromptVersion };
}
