// =============================================================================
// Shared Prompt Fetcher
// Fetches sport-specific or default system prompt from agent_system_prompts table.
// Used by generate-avatar-picks, auto-generate-avatar-picks, and
// process-agent-generation-job-v2.
// =============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

  // For single-sport agents, try a sport-specific prompt first
  if (preferredSports.length === 1) {
    const sport = preferredSports[0];
    const { data: sportPromptRow } = await client
      .from('agent_system_prompts')
      .select('id, prompt_text')
      .eq('is_active', true)
      .eq('sport', sport)
      .single();

    if (sportPromptRow) {
      remotePromptTemplate = sportPromptRow.prompt_text;
      systemPromptVersion = String(sportPromptRow.id || 'unknown');
      console.log(`${logPrefix} Loaded sport-specific system prompt: ${systemPromptVersion} (sport=${sport})`);
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
