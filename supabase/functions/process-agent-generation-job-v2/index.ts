// =============================================================================
// Process Agent Generation Job V2
// Internal worker Edge Function. Claims exactly one job from the queue,
// processes it (fetch games, build prompt, call OpenAI, write picks),
// and marks it succeeded or failed.
//
// Auth: verify_jwt = false, requires x-internal-secret header.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Reuse existing modules from V1
import {
  AIResponseSchema,
  AVATAR_PICKS_JSON_SCHEMA,
  type AvatarProfile,
  type GeneratedPick,
} from '../generate-avatar-picks/pickSchema.ts';

import {
  buildSystemPrompt,
  buildUserPrompt,
  getMaxPicks,
} from '../generate-avatar-picks/promptBuilder.ts';

import {
  OUTPUT_RESERVE,
  SOFT_SEND_LIMIT,
  countPromptTokens,
  removeSituationalTrendsFromGames,
  trimGamesByLatestTipoff,
  type PayloadBudgetMode,
  type PromptTokenCount,
} from '../shared/tokenBudget.ts';

// Shared game helpers — extracted to avoid importing V1's serve() side effect
import {
  fetchGamesForSport,
  extractAssistantContent,
  normalizeDecisionTrace,
  ensureFormattedGameSnapshot,
  gameMatchesPickId,
  gameMatchesRawGame,
} from '../shared/agentGameHelpers.ts';

// =============================================================================
// Constants
// =============================================================================

const MIN_GAMES_FOR_SLATE = 3;
const WORKER_ID_PREFIX = 'worker-v2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let claimedRunId: string | null = null;
  let supabaseClientRef: SupabaseClient | null = null;

  try {
    // -------------------------------------------------------------------------
    // 1. Validate Internal Auth
    // -------------------------------------------------------------------------
    const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';
    const providedSecret = req.headers.get('x-internal-secret') ?? '';

    if (!internalSecret) {
      console.error('[worker-v2] INTERNAL_FUNCTION_SECRET is not configured');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (providedSecret !== internalSecret) {
      // Also accept service role key as Bearer token fallback
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const authHeader = req.headers.get('Authorization') ?? '';
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!serviceKey || bearerToken !== serviceKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2. Initialize Clients
    // -------------------------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const cfbSupabaseUrl = Deno.env.get('CFB_SUPABASE_URL') ?? '';
    const cfbSupabaseKey = Deno.env.get('CFB_SUPABASE_ANON_KEY') ?? '';
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing Supabase configuration');
    if (!cfbSupabaseUrl || !cfbSupabaseKey) throw new Error('Missing CFB Supabase configuration');
    if (!openaiApiKey) throw new Error('Missing OpenAI API key');

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    supabaseClientRef = supabaseClient;
    const cfbClient = createClient(cfbSupabaseUrl, cfbSupabaseKey);

    // -------------------------------------------------------------------------
    // 3. Claim One Job
    // -------------------------------------------------------------------------
    const workerId = `${WORKER_ID_PREFIX}-${crypto.randomUUID().slice(0, 8)}`;

    const { data: claimedRuns, error: claimError } = await supabaseClient.rpc(
      'claim_generation_runs_v2',
      { p_worker_id: workerId, p_limit: 1, p_lease_seconds: 300 }
    );

    if (claimError) {
      console.error('[worker-v2] Claim error:', claimError);
      throw new Error(`Failed to claim job: ${claimError.message}`);
    }

    if (!claimedRuns || claimedRuns.length === 0) {
      return new Response(
        JSON.stringify({ success: true, claimed: 0, message: 'No jobs available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const run = claimedRuns[0];
    claimedRunId = run.id;
    console.log(`[worker-v2] Claimed run ${run.id} for avatar ${run.avatar_id} (${run.generation_type})`);

    // -------------------------------------------------------------------------
    // 4. Mark Processing
    // -------------------------------------------------------------------------
    await supabaseClient.rpc('mark_generation_run_processing_v2', { p_run_id: run.id });

    // -------------------------------------------------------------------------
    // 5. Fetch Avatar Profile
    // -------------------------------------------------------------------------
    const { data: profile, error: profileError } = await supabaseClient
      .from('avatar_profiles')
      .select('*')
      .eq('id', run.avatar_id)
      .single();

    if (profileError || !profile) {
      await markFailed(supabaseClient, run.id, 'AVATAR_NOT_FOUND', 'Avatar profile not found', false);
      return workerResponse(run.id, 'failed_terminal', 0, startTime);
    }

    // -------------------------------------------------------------------------
    // 6. Fetch System Prompt
    // -------------------------------------------------------------------------
    let remotePromptTemplate: string | null = null;
    let systemPromptVersion = 'hardcoded_fallback';

    const { data: promptRow } = await supabaseClient
      .from('agent_system_prompts')
      .select('id, prompt_text')
      .eq('is_active', true)
      .single();

    if (promptRow) {
      remotePromptTemplate = promptRow.prompt_text;
      systemPromptVersion = String(promptRow.id || 'unknown');
    }

    // -------------------------------------------------------------------------
    // 7. Fetch Games for Avatar's Sports
    // -------------------------------------------------------------------------
    const targetDate = run.target_date;
    const avatarProfile = profile as AvatarProfile;
    const allGamesData: { sport: string; games: unknown[]; formattedGames: unknown[] }[] = [];

    for (const sport of avatarProfile.preferred_sports) {
      const { games, formattedGames } = await fetchGamesForSport(cfbClient, supabaseClient, sport, targetDate);
      if (games.length > 0) {
        allGamesData.push({ sport, games, formattedGames });
      }
    }

    const totalGames = allGamesData.reduce((sum, sd) => sum + sd.games.length, 0);

    // -------------------------------------------------------------------------
    // 8. Handle No Games / Weak Slate
    // -------------------------------------------------------------------------
    if (totalGames === 0) {
      await supabaseClient.rpc('mark_generation_run_succeeded_v2', {
        p_run_id: run.id,
        p_picks_generated: 0,
        p_prompt_version: systemPromptVersion,
        p_no_games: true,
      });
      console.log(`[worker-v2] No games for run ${run.id}`);
      return workerResponse(run.id, 'succeeded', 0, startTime);
    }

    if (totalGames < MIN_GAMES_FOR_SLATE && avatarProfile.personality_params?.skip_weak_slates) {
      await supabaseClient.rpc('mark_generation_run_succeeded_v2', {
        p_run_id: run.id,
        p_picks_generated: 0,
        p_prompt_version: systemPromptVersion,
        p_weak_slate: true,
      });
      console.log(`[worker-v2] Weak slate for run ${run.id}`);
      return workerResponse(run.id, 'succeeded', 0, startTime);
    }

    // -------------------------------------------------------------------------
    // 9. Build Prompt with Token Budget Management
    // -------------------------------------------------------------------------
    const systemPrompt = buildSystemPrompt(avatarProfile, avatarProfile.preferred_sports, remotePromptTemplate);

    const combinedGames: Record<string, unknown>[] = allGamesData.flatMap(sd =>
      sd.formattedGames.map(game => ({
        ...game as Record<string, unknown>,
        sport: sd.sport.toUpperCase(),
      }))
    );

    const fullUserPrompt = buildUserPrompt(combinedGames, 'MULTI', targetDate);
    const fullTokenCount = countPromptTokens(systemPrompt, fullUserPrompt, OUTPUT_RESERVE);

    let selectedCombinedGames = combinedGames;
    let selectedUserPrompt = fullUserPrompt;
    let finalTokenCount = fullTokenCount;
    let modeUsed: PayloadBudgetMode = 'full';
    let removedGameIds: string[] = [];
    let noTrendsTokenCount: PromptTokenCount | null = null;

    if (fullTokenCount.total_tokens > SOFT_SEND_LIMIT) {
      const gamesWithoutTrends = removeSituationalTrendsFromGames(combinedGames);
      const noTrendsUserPrompt = buildUserPrompt(gamesWithoutTrends, 'MULTI', targetDate);
      noTrendsTokenCount = countPromptTokens(systemPrompt, noTrendsUserPrompt, OUTPUT_RESERVE);

      selectedCombinedGames = gamesWithoutTrends;
      selectedUserPrompt = noTrendsUserPrompt;
      finalTokenCount = noTrendsTokenCount;
      modeUsed = 'no_trends';

      if (noTrendsTokenCount.total_tokens > SOFT_SEND_LIMIT) {
        const trimResult = trimGamesByLatestTipoff({
          games: gamesWithoutTrends,
          systemPrompt,
          softLimit: SOFT_SEND_LIMIT,
          outputReserve: OUTPUT_RESERVE,
          buildUserPrompt,
          targetDate,
          sport: 'MULTI',
        });

        selectedCombinedGames = trimResult.trimmedGames;
        selectedUserPrompt = buildUserPrompt(selectedCombinedGames, 'MULTI', targetDate);
        finalTokenCount = trimResult.finalTokenCount;
        removedGameIds = trimResult.removedGameIds;
        modeUsed = 'no_trends_trimmed';
      }
    }

    if (finalTokenCount.total_tokens > SOFT_SEND_LIMIT) {
      await markFailed(supabaseClient, run.id, 'PAYLOAD_TOO_LARGE', 'Payload exceeds token budget after trimming', false);
      return workerResponse(run.id, 'failed_terminal', 0, startTime);
    }

    // -------------------------------------------------------------------------
    // 10. Call OpenAI
    // -------------------------------------------------------------------------
    console.log(`[worker-v2] Calling OpenAI for run ${run.id} — ${finalTokenCount.total_tokens} tokens, mode=${modeUsed}, removed=${removedGameIds.length} games`);

    // 4-minute timeout to stay within the 5-minute lease
    const abortController = new AbortController();
    const fetchTimeout = setTimeout(() => abortController.abort(), 240_000);

    let openaiResponse: Response;
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
        model: 'gpt-5-mini',
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: selectedUserPrompt }] },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: AVATAR_PICKS_JSON_SCHEMA.name,
            strict: AVATAR_PICKS_JSON_SCHEMA.strict,
            schema: AVATAR_PICKS_JSON_SCHEMA.schema,
          },
        },
        reasoning: { effort: 'minimal' },
      }),
    });
    } catch (fetchErr) {
      clearTimeout(fetchTimeout);
      const isTimeout = (fetchErr as Error).name === 'AbortError';
      await markFailed(supabaseClient, run.id, isTimeout ? 'OPENAI_TIMEOUT' : 'OPENAI_FETCH_ERROR', (fetchErr as Error).message, true);
      return workerResponse(run.id, 'failed_retryable', 0, startTime);
    } finally {
      clearTimeout(fetchTimeout);
    }

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      const retryable = openaiResponse.status >= 500 || openaiResponse.status === 429;
      await markFailed(
        supabaseClient, run.id,
        `OPENAI_${openaiResponse.status}`,
        `OpenAI API error: ${errorText.slice(0, 500)}`,
        retryable
      );
      return workerResponse(run.id, retryable ? 'failed_retryable' : 'failed_terminal', 0, startTime);
    }

    const openaiData = await openaiResponse.json();
    if (openaiData?.error) {
      await markFailed(supabaseClient, run.id, 'OPENAI_RESPONSE_ERROR', JSON.stringify(openaiData.error).slice(0, 500), true);
      return workerResponse(run.id, 'failed_retryable', 0, startTime);
    }

    // Extract token usage from response
    const usage = openaiData.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;

    // -------------------------------------------------------------------------
    // 11. Parse and Validate Response
    // -------------------------------------------------------------------------
    const rawContent = extractAssistantContent(openaiData);
    if (!rawContent) {
      await markFailed(supabaseClient, run.id, 'INVALID_RESPONSE', 'Could not extract assistant content', true);
      return workerResponse(run.id, 'failed_retryable', 0, startTime);
    }

    let aiResponse;
    try {
      aiResponse = JSON.parse(rawContent);
    } catch {
      await markFailed(supabaseClient, run.id, 'JSON_PARSE_ERROR', 'Failed to parse AI response as JSON', true);
      return workerResponse(run.id, 'failed_retryable', 0, startTime);
    }

    const validationResult = AIResponseSchema.safeParse(aiResponse);
    if (!validationResult.success && (!aiResponse.picks || !Array.isArray(aiResponse.picks))) {
      await markFailed(supabaseClient, run.id, 'VALIDATION_ERROR', 'AI response missing picks array', false);
      return workerResponse(run.id, 'failed_terminal', 0, startTime);
    }

    const picks = aiResponse.picks as GeneratedPick[];
    const maxPicks = getMaxPicks(avatarProfile.personality_params?.max_picks_per_day);
    const limitedPicks = picks.slice(0, maxPicks);

    // -------------------------------------------------------------------------
    // 12. Build and Insert Picks
    // -------------------------------------------------------------------------
    const picksToInsert: Record<string, unknown>[] = [];

    for (const pick of limitedPicks) {
      let gameSnapshot: Record<string, unknown> = {};
      let modelInputGamePayload: Record<string, unknown> | null =
        selectedCombinedGames.find((g: unknown) => gameMatchesPickId(g, pick.game_id)) as Record<string, unknown> | null;
      let sportType: 'nfl' | 'cfb' | 'nba' | 'ncaab' = 'nfl';
      let matchup = '';
      let gameDate = targetDate;

      for (const sd of allGamesData) {
        const foundFormatted = sd.formattedGames.find((g: unknown) => gameMatchesPickId(g, pick.game_id));
        if (foundFormatted) {
          const game = foundFormatted as Record<string, unknown>;
          gameSnapshot = game;
          sportType = sd.sport as typeof sportType;
          matchup = String(game.matchup || `${game.away_team || ''} @ ${game.home_team || ''}` || `Game ${pick.game_id}`);
          gameDate = String(game.game_date || game.game_date_et || game.start_date || targetDate);
          if (!modelInputGamePayload) modelInputGamePayload = game;
          break;
        }

        const foundRaw = sd.games.find((g: unknown) => gameMatchesPickId(g, pick.game_id));
        if (foundRaw) {
          const rawGame = foundRaw as Record<string, unknown>;
          const matchedFormatted = sd.formattedGames.find((fg: unknown) => gameMatchesRawGame(fg, rawGame));
          const game = (matchedFormatted as Record<string, unknown>) || rawGame;
          gameSnapshot = game;
          sportType = sd.sport as typeof sportType;
          matchup = `${game.away_team} @ ${game.home_team}`;
          gameDate = String(game.game_date || game.game_date_et || game.start_date || targetDate);
          if (!modelInputGamePayload && matchedFormatted) modelInputGamePayload = matchedFormatted as Record<string, unknown>;
          break;
        }
      }

      const formattedSnapshot = ensureFormattedGameSnapshot(gameSnapshot, sportType, pick.game_id);

      picksToInsert.push({
        avatar_id: run.avatar_id,
        game_id: pick.game_id,
        sport: sportType,
        matchup: matchup || `Game ${pick.game_id}`,
        game_date: gameDate,
        bet_type: pick.bet_type,
        pick_selection: pick.selection,
        odds: pick.odds,
        units: 1.0,
        confidence: pick.confidence,
        reasoning_text: pick.reasoning,
        key_factors: pick.key_factors,
        ai_decision_trace: normalizeDecisionTrace(pick, formattedSnapshot, avatarProfile.personality_params || {}),
        ai_audit_payload: {
          system_prompt_version: systemPromptVersion,
          model_input_game_payload: modelInputGamePayload || formattedSnapshot,
          model_input_personality_payload: avatarProfile.personality_params,
          model_response_payload: pick,
        },
        archived_game_data: formattedSnapshot,
        archived_personality: avatarProfile.personality_params,
        result: 'pending',
        is_auto_generated: run.generation_type === 'auto',
      });
    }

    // For manual generation: delete existing picks for same game date, then insert
    if (run.generation_type === 'manual' && picksToInsert.length > 0) {
      const gameIds = picksToInsert.map(p => p.game_id as string);
      await supabaseClient
        .from('avatar_picks')
        .delete()
        .eq('avatar_id', run.avatar_id)
        .in('game_id', gameIds);
    }

    if (picksToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('avatar_picks')
        .upsert(picksToInsert, { onConflict: 'avatar_id,game_id,bet_type' });

      if (insertError) {
        await markFailed(supabaseClient, run.id, 'PICK_INSERT_ERROR', insertError.message, true);
        return workerResponse(run.id, 'failed_retryable', 0, startTime);
      }
    }

    // -------------------------------------------------------------------------
    // 13. Mark Succeeded
    // -------------------------------------------------------------------------
    // Estimate cost (gpt-5-mini approximate pricing)
    const estimatedCost = (inputTokens * 0.0000003) + (outputTokens * 0.0000012);

    await supabaseClient.rpc('mark_generation_run_succeeded_v2', {
      p_run_id: run.id,
      p_picks_generated: picksToInsert.length,
      p_prompt_version: systemPromptVersion,
      p_input_tokens: inputTokens,
      p_output_tokens: outputTokens,
      p_estimated_cost_usd: estimatedCost,
      p_model_name: 'gpt-5-mini',
      p_weak_slate: false,
      p_no_games: false,
    });

    // Send push notification for auto-gen runs with picks (non-fatal)
    if (run.generation_type === 'auto' && picksToInsert.length > 0) {
      try {
        const notifyResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-agent-pick-ready-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ run_id: run.id }),
          }
        );
        if (!notifyResponse.ok) {
          const errText = await notifyResponse.text();
          console.warn(`[worker-v2] Push notification failed (non-fatal): ${notifyResponse.status} ${errText.slice(0, 200)}`);
        } else {
          const notifyResult = await notifyResponse.json();
          console.log(`[worker-v2] Push notification: ${notifyResult.status ?? 'unknown'}`);
        }
      } catch (notifyErr) {
        console.warn(`[worker-v2] Push notification error (non-fatal):`, (notifyErr as Error).message);
      }
    }

    console.log(`[worker-v2] Run ${run.id} succeeded: ${picksToInsert.length} picks, ${inputTokens + outputTokens} tokens`);
    return workerResponse(run.id, 'succeeded', picksToInsert.length, startTime);

  } catch (error) {
    console.error('[worker-v2] Fatal error:', error);

    // If we claimed a run, mark it as failed so it can be retried
    if (claimedRunId && supabaseClientRef) {
      try {
        await markFailed(supabaseClientRef, claimedRunId, 'FATAL_ERROR', (error as Error).message || 'Unknown fatal error', true);
      } catch (markErr) {
        console.error('[worker-v2] Failed to mark run as failed:', markErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// =============================================================================
// Helpers
// =============================================================================

async function markFailed(
  client: SupabaseClient,
  runId: string,
  errorCode: string,
  errorMessage: string,
  retryable: boolean
) {
  await client.rpc('mark_generation_run_failed_v2', {
    p_run_id: runId,
    p_error_code: errorCode,
    p_error_message: errorMessage.slice(0, 1000),
    p_retryable: retryable,
  });
}

function workerResponse(runId: string, status: string, picksGenerated: number, startTime: number) {
  return new Response(
    JSON.stringify({
      success: true,
      run_id: runId,
      status,
      picks_generated: picksGenerated,
      duration_ms: Date.now() - startTime,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
