// Auto-Generate Avatar Picks Edge Function
// Runs on a schedule to generate daily picks for eligible avatars
// This enables users to have fresh picks waiting when they open the app

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import {
  AIResponseSchema,
  AVATAR_PICKS_JSON_SCHEMA,
  type AvatarProfile,
  type GeneratedPick,
  type PersonalityParams,
  type CustomInsights,
} from '../generate-avatar-picks/pickSchema.ts';

import {
  buildSystemPrompt,
  buildUserPrompt,
  getMaxPicks,
} from '../generate-avatar-picks/promptBuilder.ts';

// =============================================================================
// Types
// =============================================================================

interface EligibleAvatar {
  avatar_id: string;
  user_id: string;
  name: string;
  avatar_emoji: string;
  preferred_sports: string[];
  personality_params: PersonalityParams;
  custom_insights: CustomInsights;
}

interface ProcessingResult {
  avatar_id: string;
  avatar_name: string;
  picks_generated: number;
  sports: string[];
  skipped_reason?: string;
  error?: string;
}

interface AutoGenerateSummary {
  eligible_avatars: number;
  processed: number;
  skipped_weak_slate: number;
  skipped_no_games: number;
  total_picks_generated: number;
  errors: number;
}

// =============================================================================
// Constants
// =============================================================================

const MIN_GAMES_FOR_SLATE = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[auto-generate-avatar-picks] Starting scheduled generation run');

  const startTime = Date.now();
  const results: ProcessingResult[] = [];
  const summary: AutoGenerateSummary = {
    eligible_avatars: 0,
    processed: 0,
    skipped_weak_slate: 0,
    skipped_no_games: 0,
    total_picks_generated: 0,
    errors: 0,
  };

  try {
    // -------------------------------------------------------------------------
    // 1. Initialize Supabase Clients
    // -------------------------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const cfbSupabaseUrl = Deno.env.get('CFB_SUPABASE_URL') ?? '';
    const cfbSupabaseKey = Deno.env.get('CFB_SUPABASE_ANON_KEY') ?? '';
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    if (!cfbSupabaseUrl || !cfbSupabaseKey) {
      throw new Error('Missing CFB Supabase configuration');
    }

    if (!openaiApiKey) {
      throw new Error('Missing OpenAI API key');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const cfbClient = createClient(cfbSupabaseUrl, cfbSupabaseKey);

    // -------------------------------------------------------------------------
    // 2. Fetch Active System Prompt from Database
    // -------------------------------------------------------------------------
    let remotePromptTemplate: string | null = null;
    let systemPromptVersion: string = 'hardcoded_fallback';

    const { data: promptRow, error: promptError } = await supabaseClient
      .from('agent_system_prompts')
      .select('id, prompt_text')
      .eq('is_active', true)
      .single();

    if (promptError || !promptRow) {
      console.warn('[auto-generate-avatar-picks] No active system prompt found, using hardcoded fallback');
    } else {
      remotePromptTemplate = promptRow.prompt_text;
      systemPromptVersion = String(promptRow.id || 'unknown');
      console.log(`[auto-generate-avatar-picks] Loaded remote system prompt template: ${systemPromptVersion}`);
    }

    // -------------------------------------------------------------------------
    // 3. Fetch Eligible Avatars
    // -------------------------------------------------------------------------
    const { data: eligibleAvatars, error: fetchError } = await supabaseClient
      .rpc('get_eligible_avatars_for_auto_generation');

    if (fetchError) {
      console.error('[auto-generate-avatar-picks] Error fetching eligible avatars:', fetchError);
      throw new Error(`Failed to fetch eligible avatars: ${fetchError.message}`);
    }

    const avatars = (eligibleAvatars || []) as EligibleAvatar[];
    summary.eligible_avatars = avatars.length;

    console.log(`[auto-generate-avatar-picks] Found ${avatars.length} eligible avatars`);

    if (avatars.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          summary,
          details: [],
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------------------
    // 3. Pre-fetch Today's Games for All Sports
    // -------------------------------------------------------------------------
    // Use US Eastern time since game dates are stored in ET
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).toISOString().split('T')[0];
    const gamesByPort: Record<string, { games: unknown[]; formattedGames: unknown[] }> = {};

    // Determine which sports need to be fetched
    const allSports = new Set<string>();
    for (const avatar of avatars) {
      for (const sport of avatar.preferred_sports) {
        allSports.add(sport);
      }
    }

    console.log(`[auto-generate-avatar-picks] Fetching games for sports: ${Array.from(allSports).join(', ')}`);

    // Fetch games for each sport once
    for (const sport of allSports) {
      const { games, formattedGames } = await fetchGamesForSport(cfbClient, supabaseClient, sport, today);
      gamesByPort[sport] = { games, formattedGames };
      console.log(`[auto-generate-avatar-picks] ${sport.toUpperCase()}: ${games.length} games found`);
    }

    // -------------------------------------------------------------------------
    // 4. Process Each Eligible Avatar
    // -------------------------------------------------------------------------
    for (const avatar of avatars) {
      const result = await processAvatar(
        avatar,
        gamesByPort,
        today,
        supabaseClient,
        openaiApiKey,
        remotePromptTemplate,
        systemPromptVersion
      );

      results.push(result);

      if (result.error) {
        summary.errors++;
      } else if (result.skipped_reason === 'weak_slate') {
        summary.skipped_weak_slate++;
      } else if (result.skipped_reason === 'no_games') {
        summary.skipped_no_games++;
      } else {
        summary.processed++;
        summary.total_picks_generated += result.picks_generated;
      }
    }

    // -------------------------------------------------------------------------
    // 5. Return Summary
    // -------------------------------------------------------------------------
    const durationMs = Date.now() - startTime;
    console.log(`[auto-generate-avatar-picks] Completed in ${durationMs}ms`);
    console.log(`[auto-generate-avatar-picks] Summary: ${JSON.stringify(summary)}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        details: results,
        duration_ms: durationMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auto-generate-avatar-picks] Fatal error:', error);
    console.error('[auto-generate-avatar-picks] Stack:', (error as Error).stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'Unknown error',
        summary,
        details: results,
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// =============================================================================
// Process Single Avatar
// =============================================================================

async function processAvatar(
  avatar: EligibleAvatar,
  gamesByPort: Record<string, { games: unknown[]; formattedGames: unknown[] }>,
  targetDate: string,
  supabaseClient: SupabaseClient,
  openaiApiKey: string,
  remotePromptTemplate: string | null,
  systemPromptVersion: string
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    avatar_id: avatar.avatar_id,
    avatar_name: avatar.name,
    picks_generated: 0,
    sports: avatar.preferred_sports,
  };

  try {
    console.log(`[auto-generate-avatar-picks] Processing avatar: ${avatar.name} (${avatar.avatar_id})`);

    // Build avatar profile structure for prompt building
    const avatarProfile: AvatarProfile = {
      id: avatar.avatar_id,
      user_id: avatar.user_id,
      name: avatar.name,
      avatar_emoji: avatar.avatar_emoji || '',
      avatar_color: '',
      preferred_sports: avatar.preferred_sports,
      archetype: null,
      personality_params: avatar.personality_params,
      custom_insights: avatar.custom_insights || {},
      is_public: false,
      is_active: true,
      auto_generate: true,
      last_generated_at: null,
      last_auto_generated_at: null,
      owner_last_active_at: null,
      created_at: '',
      updated_at: '',
    };

    // -------------------------------------------------------------------------
    // Gather Games for This Avatar's Sports
    // -------------------------------------------------------------------------
    const allGamesData: { sport: string; games: unknown[]; formattedGames: unknown[] }[] = [];

    for (const sport of avatar.preferred_sports) {
      const sportData = gamesByPort[sport];
      if (sportData && sportData.games.length > 0) {
        allGamesData.push({
          sport,
          games: sportData.games,
          formattedGames: sportData.formattedGames,
        });
      }
    }

    const totalGames = allGamesData.reduce((sum, sd) => sum + sd.games.length, 0);

    // -------------------------------------------------------------------------
    // Check for No Games
    // -------------------------------------------------------------------------
    if (totalGames === 0) {
      console.log(`[auto-generate-avatar-picks] No games for ${avatar.name}, skipping`);
      result.skipped_reason = 'no_games';

      // Still update last_auto_generated_at to prevent retry spam
      await updateAutoGeneratedTimestamp(supabaseClient, avatar.avatar_id);

      return result;
    }

    // -------------------------------------------------------------------------
    // Apply Weak Slate Logic
    // -------------------------------------------------------------------------
    if (totalGames < MIN_GAMES_FOR_SLATE && avatar.personality_params.skip_weak_slates) {
      console.log(`[auto-generate-avatar-picks] Weak slate for ${avatar.name} (${totalGames} games), skipping`);
      result.skipped_reason = 'weak_slate';

      // Update timestamp to prevent retry
      await updateAutoGeneratedTimestamp(supabaseClient, avatar.avatar_id);

      return result;
    }

    // -------------------------------------------------------------------------
    // Build AI Prompt
    // -------------------------------------------------------------------------
    const systemPrompt = buildSystemPrompt(avatarProfile, avatar.preferred_sports, remotePromptTemplate);

    // Combine all formatted games with sport labels
    const combinedGames = allGamesData.flatMap(sd =>
      sd.formattedGames.map(game => ({
        ...game as Record<string, unknown>,
        sport: sd.sport.toUpperCase(),
      }))
    );

    const userPrompt = buildUserPrompt(combinedGames, 'MULTI', targetDate);

    // -------------------------------------------------------------------------
    // Call OpenAI
    // -------------------------------------------------------------------------
    console.log(`[auto-generate-avatar-picks] Calling OpenAI for ${avatar.name}...`);

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: userPrompt }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: AVATAR_PICKS_JSON_SCHEMA.name,
            strict: AVATAR_PICKS_JSON_SCHEMA.strict,
            schema: AVATAR_PICKS_JSON_SCHEMA.schema,
          },
        },
        reasoning: {
          effort: 'minimal',
        },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error ${openaiResponse.status}: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    if (openaiData?.error) {
      throw new Error(`OpenAI responses error: ${JSON.stringify(openaiData.error)}`);
    }

    const rawContent = extractAssistantContent(openaiData);
    if (!rawContent) {
      const snippet = JSON.stringify(openaiData).slice(0, 1200);
      console.error('[auto-generate-avatar-picks] Unexpected OpenAI response:', snippet);
      throw new Error(`Invalid OpenAI response structure: ${snippet}`);
    }

    // -------------------------------------------------------------------------
    // Parse and Validate Response
    // -------------------------------------------------------------------------
    let aiResponse;

    try {
      aiResponse = JSON.parse(rawContent);
    } catch (parseError) {
      throw new Error('Failed to parse AI response as JSON');
    }

    const validationResult = AIResponseSchema.safeParse(aiResponse);

    if (!validationResult.success && (!aiResponse.picks || !Array.isArray(aiResponse.picks))) {
      throw new Error('AI response missing picks array');
    }

    const picks = aiResponse.picks as GeneratedPick[];

    // Enforce max picks limit
    const maxPicks = getMaxPicks(avatar.personality_params.max_picks_per_day);
    const limitedPicks = picks.slice(0, maxPicks);

    console.log(`[auto-generate-avatar-picks] ${avatar.name} generated ${limitedPicks.length} picks`);

    // -------------------------------------------------------------------------
    // Build Game Snapshots and Insert Picks
    // -------------------------------------------------------------------------
    const now = new Date().toISOString();
    const todayDate = targetDate;
    const picksToInsert: Record<string, unknown>[] = [];

    for (const pick of limitedPicks) {
      // Find the original game data for snapshot
      let gameSnapshot: Record<string, unknown> = {};
      let modelInputGamePayload: Record<string, unknown> | null =
        combinedGames.find((g: unknown) => gameMatchesPickId(g, pick.game_id)) as Record<string, unknown> | null;
      let sportType: 'nfl' | 'cfb' | 'nba' | 'ncaab' = 'nfl';
      let matchup = '';
      let gameDate = todayDate;

      for (const sd of allGamesData) {
        const foundFormatted = sd.formattedGames.find((g: unknown) => gameMatchesPickId(g, pick.game_id));
        if (foundFormatted) {
          const game = foundFormatted as Record<string, unknown>;
          gameSnapshot = game;
          sportType = sd.sport as typeof sportType;
          matchup = String(game.matchup || `${game.away_team || ''} @ ${game.home_team || ''}` || `Game ${pick.game_id}`);
          gameDate = String(game.game_date || game.game_date_et || game.start_date || todayDate);
          if (!modelInputGamePayload) {
            modelInputGamePayload = game;
          }
          break;
        }

        const foundRaw = sd.games.find((g: unknown) => gameMatchesPickId(g, pick.game_id));
        if (foundRaw) {
          const rawGame = foundRaw as Record<string, unknown>;
          const matchedFormatted = sd.formattedGames.find((fg: unknown) =>
            gameMatchesRawGame(fg, rawGame)
          );
          const game = (matchedFormatted as Record<string, unknown>) || rawGame;
          gameSnapshot = game;
          sportType = sd.sport as typeof sportType;
          matchup = `${game.away_team} @ ${game.home_team}`;
          gameDate = String(game.game_date || game.game_date_et || game.start_date || todayDate);
          if (!modelInputGamePayload && matchedFormatted) {
            modelInputGamePayload = matchedFormatted as Record<string, unknown>;
          }
          break;
        }
      }

      const formattedSnapshot = ensureFormattedGameSnapshot(gameSnapshot, sportType, pick.game_id);

      // Build pick record matching the actual database schema
      const avatarPickRecord = {
        avatar_id: avatar.avatar_id,
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
        ai_decision_trace: normalizeDecisionTrace(pick, formattedSnapshot, avatar.personality_params),
        ai_audit_payload: {
          system_prompt_version: systemPromptVersion,
          model_input_game_payload: modelInputGamePayload || formattedSnapshot,
          model_input_personality_payload: avatar.personality_params,
          model_response_payload: pick,
        },
        archived_game_data: formattedSnapshot,
        archived_personality: avatar.personality_params,
        result: 'pending',
        is_auto_generated: true,
      };

      picksToInsert.push(avatarPickRecord);
    }

    // Insert all picks
    if (picksToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('avatar_picks')
        .insert(picksToInsert);

      if (insertError) {
        throw new Error(`Failed to save picks: ${insertError.message}`);
      }
    }

    result.picks_generated = picksToInsert.length;

    // -------------------------------------------------------------------------
    // Update Avatar Timestamp
    // -------------------------------------------------------------------------
    await updateAutoGeneratedTimestamp(supabaseClient, avatar.avatar_id);

    console.log(`[auto-generate-avatar-picks] Completed ${avatar.name}: ${picksToInsert.length} picks`);

    return result;

  } catch (error) {
    console.error(`[auto-generate-avatar-picks] Error processing ${avatar.name}:`, error);
    result.error = (error as Error).message;
    return result;
  }
}

// =============================================================================
// Helper: Update Auto-Generated Timestamp
// =============================================================================

async function updateAutoGeneratedTimestamp(
  supabaseClient: SupabaseClient,
  avatarId: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabaseClient
    .from('avatar_profiles')
    .update({
      last_auto_generated_at: now,
      updated_at: now,
    })
    .eq('id', avatarId);

  if (error) {
    console.error(`[auto-generate-avatar-picks] Failed to update timestamp for ${avatarId}:`, error);
  }
}

function normalizeDecisionTrace(
  pick: GeneratedPick,
  gameSnapshot: Record<string, unknown>,
  personality: Record<string, unknown>
): Record<string, unknown> {
  const raw = (pick as unknown as { decision_trace?: unknown }).decision_trace;

  let leanedMetrics = normalizeLeanedMetrics(raw);
  if (leanedMetrics.length === 0) {
    leanedMetrics = deriveLeanedMetricsFromGameSnapshot(pick, gameSnapshot);
  }
  if (leanedMetrics.length === 0) {
    leanedMetrics = (pick.key_factors || []).slice(0, 5).map((factor, idx) => ({
      metric_key: `key_factor_${idx + 1}`,
      metric_value: factor,
      why_it_mattered: factor,
      personality_trait: 'General model preference',
    }));
  }

  const rationaleSummary = normalizeTraceString(
    raw,
    ['rationale_summary', 'rationaleSummary', 'summary', 'reasoning_summary'],
    pick.reasoning
  );
  const personalityAlignment = normalizeTraceString(
    raw,
    ['personality_alignment', 'personalityAlignment', 'alignment'],
    buildPersonalityAlignmentFromSettings(personality, pick.bet_type)
  );
  const otherMetrics = normalizeTraceStringArray(raw, [
    'other_metrics_considered',
    'otherMetricsConsidered',
    'secondary_metrics',
  ]);

  return {
    leaned_metrics: leanedMetrics,
    rationale_summary: rationaleSummary,
    personality_alignment: personalityAlignment,
    other_metrics_considered: otherMetrics,
  };
}

function normalizeLeanedMetrics(rawTrace: unknown): Array<Record<string, unknown>> {
  if (!rawTrace || typeof rawTrace !== 'object') return [];
  const trace = rawTrace as Record<string, unknown>;
  const candidates =
    (trace.leaned_metrics as unknown[]) ||
    (trace.leanedMetrics as unknown[]) ||
    (trace.metrics_used as unknown[]) ||
    [];

  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const m = entry as Record<string, unknown>;
      const metricKey = String(m.metric_key ?? m.metricKey ?? m.key ?? m.name ?? '').trim();
      const metricValue = String(m.metric_value ?? m.metricValue ?? m.value ?? '').trim();
      const whyItMattered = String(m.why_it_mattered ?? m.whyItMattered ?? m.why ?? m.reason ?? '').trim();
      const personalityTrait = String(m.personality_trait ?? m.personalityTrait ?? m.trait ?? '').trim();
      const weightRaw = m.weight;
      const weight = typeof weightRaw === 'number' ? weightRaw : undefined;

      if (!metricKey || !metricValue || !whyItMattered) return null;
      return {
        metric_key: metricKey,
        metric_value: metricValue,
        why_it_mattered: whyItMattered,
        personality_trait: personalityTrait || 'Model preference',
        ...(weight !== undefined ? { weight } : {}),
      };
    })
    .filter((v): v is Record<string, unknown> => !!v);
}

function normalizeTraceString(
  rawTrace: unknown,
  keys: string[],
  fallback: string
): string {
  if (rawTrace && typeof rawTrace === 'object') {
    const trace = rawTrace as Record<string, unknown>;
    for (const key of keys) {
      const value = trace[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return fallback;
}

function normalizeTraceStringArray(rawTrace: unknown, keys: string[]): string[] {
  if (!rawTrace || typeof rawTrace !== 'object') return [];
  const trace = rawTrace as Record<string, unknown>;
  for (const key of keys) {
    const value = trace[key];
    if (Array.isArray(value)) {
      return value
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
        .slice(0, 12);
    }
  }
  return [];
}

function buildPersonalityAlignmentFromSettings(
  personality: Record<string, unknown>,
  betType: string
): string {
  const preferredBetType = String(personality.preferred_bet_type || 'any');
  const riskTolerance = Number(personality.risk_tolerance || 3);
  const confidenceThreshold = Number(personality.confidence_threshold || 3);
  const trustModel = Number(personality.trust_model || 3);
  const trustPolymarket = Number(personality.trust_polymarket || 3);
  const skipWeakSlates = Boolean(personality.skip_weak_slates);
  return `Aligned with profile: selected a ${betType} angle with preferred_bet_type=${preferredBetType}, risk_tolerance=${riskTolerance}/5, confidence_threshold=${confidenceThreshold}/5, trust_model=${trustModel}/5, trust_polymarket=${trustPolymarket}/5, skip_weak_slates=${skipWeakSlates}.`;
}

function deriveLeanedMetricsFromGameSnapshot(
  pick: GeneratedPick,
  gameSnapshot: Record<string, unknown>
): Array<Record<string, unknown>> {
  const metrics: Array<Record<string, unknown>> = [];
  const vegas = asRecord(gameSnapshot.vegas_lines);
  const teamStats = asRecord(gameSnapshot.team_stats);
  const model = asRecord(gameSnapshot.model_predictions);
  const raw = asRecord(asRecord(gameSnapshot.game_data_complete).raw_game_data);
  const awayTeam = String(gameSnapshot.away_team || raw.away_team || 'Away');
  const homeTeam = String(gameSnapshot.home_team || raw.home_team || 'Home');

  const homeSpread = asNumber(vegas.home_spread) ?? asNumber(raw.home_spread) ?? asNumber(raw.api_spread) ?? asNumber(raw.spread);
  if (homeSpread !== null) {
    metrics.push({
      metric_key: 'vegas_lines.home_spread',
      metric_value: String(homeSpread),
      why_it_mattered: `The spread baseline was ${homeTeam} ${fmtSpread(homeSpread)} / ${awayTeam} ${fmtSpread(-homeSpread)}.`,
      personality_trait: 'Preferred market pricing context',
    });
  }

  const homeOff = asNumber(teamStats.home_offense) ?? asNumber(raw.home_adj_offense);
  const awayOff = asNumber(teamStats.away_offense) ?? asNumber(raw.away_adj_offense);
  if (homeOff !== null && awayOff !== null) {
    metrics.push({
      metric_key: 'team_stats.offense_delta',
      metric_value: `${homeTeam} ${homeOff.toFixed(2)} vs ${awayTeam} ${awayOff.toFixed(2)}`,
      why_it_mattered: 'Relative offensive efficiency shaped expected scoring margin.',
      personality_trait: 'Model-driven team quality weighting',
    });
  }

  const homeDef = asNumber(teamStats.home_defense) ?? asNumber(raw.home_adj_defense);
  const awayDef = asNumber(teamStats.away_defense) ?? asNumber(raw.away_adj_defense);
  if (homeDef !== null && awayDef !== null) {
    metrics.push({
      metric_key: 'team_stats.defense_delta',
      metric_value: `${homeTeam} ${homeDef.toFixed(2)} vs ${awayTeam} ${awayDef.toFixed(2)}`,
      why_it_mattered: 'Defensive efficiency impacted expected cover probability and variance.',
      personality_trait: 'Risk-managed side selection',
    });
  }

  const spreadProb =
    asNumber(model.spread_cover_prob) ??
    asNumber(raw.home_away_spread_cover_prob) ??
    asNumber(raw.pred_spread_proba);
  if (spreadProb !== null) {
    metrics.push({
      metric_key: 'model_predictions.spread_cover_prob',
      metric_value: spreadProb.toFixed(3),
      why_it_mattered: 'Model cover probability was used as a primary confidence anchor.',
      personality_trait: 'trust_model',
      weight: 0.8,
    });
  }

  return metrics.slice(0, 8);
}

function ensureFormattedGameSnapshot(
  snapshot: Record<string, unknown>,
  sport: 'nfl' | 'cfb' | 'nba' | 'ncaab',
  fallbackGameId: string
): Record<string, unknown> {
  if (isFormattedGameSnapshot(snapshot)) return snapshot;

  const homeSpread = asNumber(snapshot.home_spread) ?? asNumber(snapshot.api_spread) ?? asNumber(snapshot.spread);
  const awaySpread = asNumber(snapshot.away_spread) ?? (homeSpread !== null ? -homeSpread : null);
  const awayTeam = String(snapshot.away_team || 'Away');
  const homeTeam = String(snapshot.home_team || 'Home');
  const spreadSummary =
    homeSpread !== null
      ? `${awayTeam} ${fmtSpread(awaySpread)} / ${homeTeam} ${fmtSpread(homeSpread)}`
      : `${awayTeam} vs ${homeTeam}`;

  const spreadProb =
    asNumber(snapshot.home_away_spread_cover_prob) ??
    asNumber(snapshot.pred_spread_proba) ??
    null;

  return {
    game_id: String(snapshot.game_id || snapshot.training_key || snapshot.unique_id || fallbackGameId),
    matchup: `${awayTeam} @ ${homeTeam}`,
    away_team: awayTeam,
    home_team: homeTeam,
    game_date: String(snapshot.game_date || snapshot.game_date_et || snapshot.start_date || ''),
    game_time: String(snapshot.game_time || snapshot.tipoff_time_et || snapshot.start_utc || '00:00:00'),
    vegas_lines: {
      spread_summary: spreadSummary,
      ml_summary: `${awayTeam} ${fmtML(snapshot.away_ml ?? snapshot.away_moneyline ?? snapshot.awayMoneyline) ?? 'N/A'} / ${homeTeam} ${fmtML(snapshot.home_ml ?? snapshot.home_moneyline ?? snapshot.homeMoneyline) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(snapshot.home_ml ?? snapshot.home_moneyline ?? snapshot.homeMoneyline),
      away_ml: fmtML(snapshot.away_ml ?? snapshot.away_moneyline ?? snapshot.awayMoneyline),
      total: snapshot.over_line ?? snapshot.total_line ?? snapshot.over_under ?? null,
    },
    model_predictions: {
      spread_cover_prob: spreadProb,
      ml_prob: snapshot.home_away_ml_prob ?? snapshot.pred_ml_proba ?? null,
      ou_prob: snapshot.ou_result_prob ?? snapshot.pred_total_proba ?? null,
    },
    game_data_complete: {
      source_table: `raw_fallback_${sport}`,
      raw_game_data: snapshot,
    },
  };
}

function isFormattedGameSnapshot(snapshot: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(snapshot, 'vegas_lines') ||
    Object.prototype.hasOwnProperty.call(snapshot, 'model_predictions') ||
    Object.prototype.hasOwnProperty.call(snapshot, 'game_data_complete')
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function extractAssistantContent(openaiData: Record<string, unknown>): string | null {
  const outputText = openaiData.output_text;
  if (typeof outputText === 'string' && outputText.trim().length > 0) {
    return outputText.trim();
  }

  const choices = openaiData.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    const message = (first.message || {}) as Record<string, unknown>;
    const content = message.content;

    if (typeof content === 'string' && content.trim().length > 0) {
      return content;
    }

    if (Array.isArray(content)) {
      const joined = content
        .map((part) => {
          if (!part || typeof part !== 'object') return '';
          const p = part as Record<string, unknown>;
          if (p.json && typeof p.json === 'object') return JSON.stringify(p.json);
          if (typeof p.text === 'string') return p.text;
          if (typeof p.content === 'string') return p.content;
          return '';
        })
        .join('\n')
        .trim();
      if (joined.length > 0) return joined;
    }
  }

  const output = openaiData.output;
  if (Array.isArray(output)) {
    const joined = output
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        const outputItem = item as Record<string, unknown>;
        const outputContent = outputItem.content;
        if (!Array.isArray(outputContent)) return '';
        return outputContent
          .map((part) => {
            if (!part || typeof part !== 'object') return '';
            const p = part as Record<string, unknown>;
            if (p.json && typeof p.json === 'object') return JSON.stringify(p.json);
            if (typeof p.text === 'string') return p.text;
            if (typeof p.content === 'string') return p.content;
            return '';
          })
          .filter(Boolean)
          .join('\n');
      })
      .filter(Boolean)
      .join('\n')
      .trim();
    if (joined.length > 0) return joined;
  }

  return null;
}


function gameMatchesPickId(game: unknown, pickGameId: string): boolean {
  const g = game as Record<string, unknown>;
  const normalizedPickId = String(pickGameId || '').trim();
  const gameId =
    g.game_id ||
    g.training_key ||
    g.unique_id ||
    `${String(g.away_team || '').trim()}_${String(g.home_team || '').trim()}`;

  return String(gameId || '').trim() === normalizedPickId;
}

function gameMatchesRawGame(formattedGame: unknown, rawGame: Record<string, unknown>): boolean {
  const fg = formattedGame as Record<string, unknown>;
  const rawAway = String(rawGame.away_team || '').trim().toLowerCase();
  const rawHome = String(rawGame.home_team || '').trim().toLowerCase();
  const fgAway = String(fg.away_team || '').trim().toLowerCase();
  const fgHome = String(fg.home_team || '').trim().toLowerCase();

  if (rawAway && rawHome && fgAway === rawAway && fgHome === rawHome) {
    return true;
  }

  const rawTrainingKey = String(rawGame.training_key || '');
  const rawUniqueId = String(rawGame.unique_id || '');
  const fgTrainingKey = String(fg.training_key || '');
  const fgUniqueId = String(fg.unique_id || '');

  return (
    (rawTrainingKey && fgTrainingKey && rawTrainingKey === fgTrainingKey) ||
    (rawUniqueId && fgUniqueId && rawUniqueId === fgUniqueId)
  );
}

// =============================================================================
// Game Fetching Functions (Reused from generate-avatar-picks)
// =============================================================================

interface GameFetchResult {
  games: unknown[];
  formattedGames: unknown[];
}

async function fetchGamesForSport(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient,
  sport: string,
  targetDate: string
): Promise<GameFetchResult> {
  switch (sport) {
    case 'nfl':
      return fetchNFLGames(cfbClient, mainClient);
    case 'cfb':
      return fetchCFBGames(cfbClient, mainClient);
    case 'nba':
      return fetchNBAGames(cfbClient, mainClient, targetDate);
    case 'ncaab':
      return fetchNCAABGames(cfbClient, mainClient, targetDate);
    default:
      return { games: [], formattedGames: [] };
  }
}

async function fetchNFLGames(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient
): Promise<GameFetchResult> {
  // Get latest run_id
  const { data: latestRun } = await cfbClient
    .from('nfl_predictions_epa')
    .select('run_id')
    .order('run_id', { ascending: false })
    .limit(1)
    .single();

  if (!latestRun) {
    return { games: [], formattedGames: [] };
  }

  const { data: games } = await cfbClient
    .from('nfl_predictions_epa')
    .select('*')
    .eq('run_id', latestRun.run_id);

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const [polymarketByGameKey, lineMovementByTrainingKey, h2hByGameKey] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'nfl', games),
    fetchLineMovementByTrainingKey(cfbClient, 'nfl_betting_lines', games),
    fetchNFLH2HByGameKey(cfbClient, games),
  ]);

  const formattedGames = games.map(game =>
    formatNFLGame(
      game,
      polymarketByGameKey.get(toGameKey('nfl', game.away_team, game.home_team)) || null,
      lineMovementByTrainingKey.get(String(game.training_key || '')) || [],
      h2hByGameKey.get(toGameKey('nfl', game.away_team, game.home_team)) || []
    )
  );
  return { games, formattedGames };
}

async function fetchCFBGames(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient
): Promise<GameFetchResult> {
  const { data: games } = await cfbClient
    .from('cfb_live_weekly_inputs')
    .select('*');

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const [polymarketByGameKey, lineMovementByTrainingKey] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'cfb', games),
    fetchLineMovementByTrainingKey(cfbClient, 'cfb_betting_lines', games),
  ]);

  const formattedGames = games.map(game =>
    formatCFBGame(
      game,
      polymarketByGameKey.get(toGameKey('cfb', game.away_team, game.home_team)) || null,
      lineMovementByTrainingKey.get(String(game.training_key || '')) || []
    )
  );
  return { games, formattedGames };
}

async function fetchNBAGames(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient,
  targetDate: string
): Promise<GameFetchResult> {
  const { data: games } = await cfbClient
    .from('nba_input_values_view')
    .select('*')
    .eq('game_date', targetDate);

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const [polymarketByGameKey, injuriesByTeam, accuracyByGameId, situationalByGameId] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'nba', games),
    fetchNBAInjuriesByTeam(cfbClient, games, targetDate),
    fetchPredictionAccuracyByGameId(cfbClient, 'nba_todays_games_predictions_with_accuracy_cache', games, targetDate, true),
    fetchSituationalTrendsByGameId(cfbClient, 'nba_game_situational_trends_today', games),
  ]);

  const formattedGames = games.map(game =>
    formatNBAGame(
      game,
      polymarketByGameKey.get(toGameKey('nba', game.away_team, game.home_team)) || null,
      injuriesByTeam.get(normalizeTeamKey(game.away_team)) || [],
      injuriesByTeam.get(normalizeTeamKey(game.home_team)) || [],
      accuracyByGameId.get(String(game.game_id || '')) || null,
      situationalByGameId.get(String(game.game_id || '')) || null
    )
  );
  return { games, formattedGames };
}

async function fetchNCAABGames(
  cfbClient: SupabaseClient,
  mainClient: SupabaseClient,
  targetDate: string
): Promise<GameFetchResult> {
  const { data: games } = await cfbClient
    .from('v_cbb_input_values')
    .select('*')
    .eq('game_date_et', targetDate);

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const [polymarketByGameKey, trendsByGameId, accuracyByGameId] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'ncaab', games),
    fetchSituationalTrendsByGameId(cfbClient, 'ncaab_game_situational_trends_today', games),
    fetchPredictionAccuracyByGameId(cfbClient, 'ncaab_todays_games_predictions_with_accuracy_cache', games, targetDate, false),
  ]);

  const formattedGames = games.map(game =>
    formatNCAABGame(
      game,
      polymarketByGameKey.get(toGameKey('ncaab', game.away_team, game.home_team)) || null,
      trendsByGameId.get(String(game.game_id || '')) || null,
      accuracyByGameId.get(String(game.game_id || '')) || null
    )
  );
  return { games, formattedGames };
}

// =============================================================================
// Game Formatting Functions (Reused from generate-avatar-picks)
// =============================================================================

/** Format a spread number for display: positive gets "+", negative stays as-is */
function fmtSpread(val: unknown): string {
  if (val === null || val === undefined) return 'N/A';
  const n = Number(val);
  if (isNaN(n)) return 'N/A';
  return n > 0 ? `+${n}` : String(n);
}

/** Format a moneyline number as an American odds string: +110, -210, etc. */
function fmtML(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  if (isNaN(n)) return null;
  return n > 0 ? `+${n}` : String(n);
}

/** Strip noisy/redundant fields from NBA raw game data before sending to AI */
const NBA_RAW_EXCLUDE = new Set([
  'away_last_ml', 'away_last_ou', 'home_last_ml', 'home_last_ou',
  'away_last_ats', 'home_last_ats',
  'away_ats_streak', 'away_win_streak', 'home_ats_streak', 'home_win_streak',
  'home_last_margin',
]);

function filterNBARawGame(game: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(game).filter(([key]) => !NBA_RAW_EXCLUDE.has(key) && !key.includes('_pregame'))
  );
}

/** Strip noisy/redundant fields from NCAAB raw game data before sending to AI */
const NCAAB_RAW_EXCLUDE = new Set([
  'away_adj_pace', 'home_adj_pace',
  'away_adj_margin', 'home_adj_margin',
  'away_adj_defense', 'away_adj_offense', 'home_adj_defense', 'home_adj_offense',
  'away_ws_prev_all_z', 'away_ws_prev_ret_z', 'home_ws_prev_all_z', 'home_ws_prev_ret_z',
  'away_roster_count_z', 'home_roster_count_z',
  'away_continuity_index', 'away_experience_index', 'home_continuity_index', 'home_experience_index',
  'away_adj_pace_trend_l3', 'home_adj_pace_trend_l3',
  'away_adj_defense_trend_l3', 'away_adj_offense_trend_l3',
  'home_adj_defense_trend_l3', 'home_adj_offense_trend_l3',
]);

function filterNCAABRawGame(game: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(game).filter(([key]) => !NCAAB_RAW_EXCLUDE.has(key))
  );
}

/** Strip W-L-P record strings from situational trends — keep only the percentage fields */
function filterSituationalTrends(trends: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!trends) return null;
  const filtered: Record<string, unknown> = {};
  for (const [side, data] of Object.entries(trends)) {
    if (data && typeof data === 'object') {
      filtered[side] = Object.fromEntries(
        Object.entries(data as Record<string, unknown>).filter(([key]) => !key.endsWith('_record'))
      );
    } else {
      filtered[side] = data;
    }
  }
  return filtered;
}

function toGameKey(sport: string, awayTeam: unknown, homeTeam: unknown): string {
  return `${sport}_${String(awayTeam || '').trim()}_${String(homeTeam || '').trim()}`;
}

function normalizeTeamKey(team: unknown): string {
  return String(team || '').trim().toLowerCase();
}

function formatPolymarketMarkets(markets: Record<string, unknown>[]): Record<string, unknown> | null {
  if (!markets.length) return null;
  const polymarket: Record<string, unknown> = {};

  for (const market of markets) {
    const marketType = String(market.market_type || '');
    const awayOdds = market.current_away_odds;
    const homeOdds = market.current_home_odds;
    if (!marketType) continue;

    if (marketType === 'total') {
      polymarket.total = {
        over_odds: awayOdds,
        under_odds: homeOdds,
        updated_at: market.last_updated || null,
      };
      continue;
    }

    polymarket[marketType] = {
      away_odds: awayOdds,
      home_odds: homeOdds,
      updated_at: market.last_updated || null,
    };
  }

  return Object.keys(polymarket).length > 0 ? polymarket : null;
}

async function fetchPolymarketByGameKey(
  mainClient: SupabaseClient,
  sport: string,
  games: Record<string, unknown>[]
): Promise<Map<string, Record<string, unknown> | null>> {
  const gameKeys = [...new Set(games.map(g => toGameKey(sport, g.away_team, g.home_team)))];
  const result = new Map<string, Record<string, unknown> | null>();
  if (gameKeys.length === 0) return result;

  try {
    const { data, error } = await mainClient
      .from('polymarket_markets')
      .select('*')
      .eq('league', sport)
      .in('game_key', gameKeys);

    if (error || !data) {
      console.warn(`[auto-generate-avatar-picks] Polymarket fetch failed for ${sport}:`, error?.message || 'No data');
      return result;
    }

    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const row of data as Record<string, unknown>[]) {
      const key = String(row.game_key || '');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(row);
    }

    for (const key of gameKeys) {
      result.set(key, formatPolymarketMarkets(grouped.get(key) || []));
    }
  } catch (error) {
    console.warn(`[auto-generate-avatar-picks] Polymarket fetch threw for ${sport}:`, (error as Error).message);
  }

  return result;
}

async function fetchLineMovementByTrainingKey(
  cfbClient: SupabaseClient,
  tableName: string,
  games: Record<string, unknown>[]
): Promise<Map<string, Record<string, unknown>[]>> {
  const trainingKeys = [...new Set(games.map(g => String(g.training_key || '')).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>[]>();
  if (trainingKeys.length === 0) return result;

  try {
    const { data, error } = await cfbClient
      .from(tableName)
      .select('training_key, as_of_ts, home_spread, away_spread, over_line')
      .in('training_key', trainingKeys)
      .order('as_of_ts', { ascending: true });

    if (error || !data) {
      console.warn(`[auto-generate-avatar-picks] Line movement fetch failed (${tableName}):`, error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const key = String(row.training_key || '');
      if (!result.has(key)) result.set(key, []);
      result.get(key)?.push(row);
    }
  } catch (error) {
    console.warn(`[auto-generate-avatar-picks] Line movement fetch threw (${tableName}):`, (error as Error).message);
  }

  return result;
}

async function fetchNFLH2HByGameKey(
  cfbClient: SupabaseClient,
  games: Record<string, unknown>[]
): Promise<Map<string, Record<string, unknown>[]>> {
  const result = new Map<string, Record<string, unknown>[]>();

  const h2hPromises = games.map(async (game) => {
    const away = String(game.away_team || '');
    const home = String(game.home_team || '');
    const key = toGameKey('nfl', away, home);

    try {
      const { data, error } = await cfbClient
        .from('nfl_training_data')
        .select('game_date, home_team, away_team, home_score, away_score, home_spread, away_spread, over_line')
        .or(`and(home_team.eq."${home}",away_team.eq."${away}"),and(home_team.eq."${away}",away_team.eq."${home}")`)
        .order('game_date', { ascending: false })
        .limit(5);

      if (!error && data) {
        result.set(key, data as Record<string, unknown>[]);
      }
    } catch (error) {
      console.warn(`[auto-generate-avatar-picks] NFL H2H fetch failed for ${away} @ ${home}:`, (error as Error).message);
    }
  });

  await Promise.all(h2hPromises);
  return result;
}

async function fetchNBAInjuriesByTeam(
  cfbClient: SupabaseClient,
  games: Record<string, unknown>[],
  targetDate: string
): Promise<Map<string, Record<string, unknown>[]>> {
  const teams = [...new Set(games.flatMap(g => [String(g.away_team || ''), String(g.home_team || '')]).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>[]>();
  if (teams.length === 0) return result;

  try {
    const { data, error } = await cfbClient
      .from('nba_injury_report')
      .select('player_name, avg_pie_season, status, team_id, team_name, team_abbr, game_date_et, bucket')
      .in('team_name', teams)
      .eq('game_date_et', targetDate)
      .eq('bucket', 'current');

    if (error || !data) {
      console.warn('[auto-generate-avatar-picks] NBA injury fetch failed:', error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const teamKey = normalizeTeamKey(row.team_name);
      if (!result.has(teamKey)) result.set(teamKey, []);
      result.get(teamKey)?.push(row);
    }
  } catch (error) {
    console.warn('[auto-generate-avatar-picks] NBA injury fetch threw:', (error as Error).message);
  }

  return result;
}

async function fetchSituationalTrendsByGameId(
  cfbClient: SupabaseClient,
  tableName: string,
  games: Record<string, unknown>[]
): Promise<Map<string, Record<string, unknown>>> {
  const gameIds = [...new Set(games.map(g => String(g.game_id || '')).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();
  if (gameIds.length === 0) return result;

  try {
    const { data, error } = await cfbClient
      .from(tableName)
      .select('*')
      .in('game_id', gameIds);

    if (error || !data) {
      return result;
    }

    // The table has TWO rows per game_id: one with team_side='away', one with team_side='home'.
    // Group them into a single object per game so the AI sees both teams' situational data.
    for (const row of data as Record<string, unknown>[]) {
      const gameId = String(row.game_id || '');
      if (!gameId) continue;

      if (!result.has(gameId)) {
        result.set(gameId, { away_team: null, home_team: null });
      }
      const entry = result.get(gameId)!;
      const teamSide = String(row.team_side || '').toLowerCase();
      if (teamSide === 'away') {
        (entry as Record<string, unknown>).away_team = row;
      } else if (teamSide === 'home') {
        (entry as Record<string, unknown>).home_team = row;
      }
    }
  } catch {
    // Optional dataset; ignore if unavailable.
  }

  return result;
}

async function fetchPredictionAccuracyByGameId(
  cfbClient: SupabaseClient,
  tableName: string,
  games: Record<string, unknown>[],
  targetDate: string,
  applyGameDateFilter: boolean
): Promise<Map<string, Record<string, unknown>>> {
  const gameIds = [...new Set(games.map(g => String(g.game_id || '')).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();
  if (gameIds.length === 0) return result;

  try {
    let query = cfbClient
      .from(tableName)
      .select('*')
      .in('game_id', gameIds);

    if (applyGameDateFilter) {
      query = query.eq('game_date', targetDate);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.warn(`[auto-generate-avatar-picks] ${tableName} fetch failed:`, error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const gameId = String(row.game_id || '');
      if (gameId) result.set(gameId, row);
    }
  } catch (error) {
    console.warn(`[auto-generate-avatar-picks] ${tableName} fetch threw:`, (error as Error).message);
  }

  return result;
}

function formatNFLGame(
  game: Record<string, unknown>,
  polymarket: Record<string, unknown> | null,
  lineMovement: Record<string, unknown>[],
  h2hGames: Record<string, unknown>[]
): Record<string, unknown> {
  const gameId = game.training_key || `${game.away_team}_${game.home_team}`;
  const homeSpread = game.home_spread as number | null;
  const awaySpread = game.away_spread as number | null;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date,
    game_time: game.game_time || '00:00:00',
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      ml_summary: `${game.away_team} ${fmtML(game.away_ml) ?? 'N/A'} / ${game.home_team} ${fmtML(game.home_ml) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(game.home_ml),
      away_ml: fmtML(game.away_ml),
      total: game.over_line,
    },
    weather: {
      temperature: game.temperature,
      wind_speed: game.wind_speed,
      precipitation: game.precipitation,
      icon: game.icon,
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
    public_betting_detailed: {
      home_ml_handle: game.home_ml_handle,
      away_ml_handle: game.away_ml_handle,
      home_ml_bets: game.home_ml_bets,
      away_ml_bets: game.away_ml_bets,
      home_spread_handle: game.home_spread_handle,
      away_spread_handle: game.away_spread_handle,
      home_spread_bets: game.home_spread_bets,
      away_spread_bets: game.away_spread_bets,
      over_handle: game.over_handle,
      under_handle: game.under_handle,
      over_bets: game.over_bets,
      under_bets: game.under_bets,
    },
    line_movement: lineMovement,
    h2h_recent: h2hGames,
    polymarket,
    model_predictions: {
      spread_cover_prob: game.home_away_spread_cover_prob,
      ml_prob: game.home_away_ml_prob,
      ou_prob: game.ou_result_prob,
      predicted_team: Number(game.home_away_spread_cover_prob || 0) > 0.5 ? game.home_team : game.away_team,
    },
    game_data_complete: {
      source_table: 'nfl_predictions_epa',
      raw_game_data: game,
    },
  };
}

function formatCFBGame(
  game: Record<string, unknown>,
  polymarket: Record<string, unknown> | null,
  lineMovement: Record<string, unknown>[]
): Record<string, unknown> {
  const gameId = game.training_key || game.unique_id || `${game.away_team}_${game.home_team}`;
  const spreadProb = game.pred_spread_proba || game.home_away_spread_cover_prob;
  const homeSpread = (game.api_spread || game.home_spread) as number | null;
  const awaySpread = game.api_spread ? -(game.api_spread as number) : game.away_spread as number | null;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date || game.start_date,
    game_time: game.game_time || game.start_time || '00:00:00',
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      ml_summary: `${game.away_team} ${fmtML(game.away_moneyline || game.away_ml) ?? 'N/A'} / ${game.home_team} ${fmtML(game.home_moneyline || game.home_ml) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(game.home_moneyline || game.home_ml),
      away_ml: fmtML(game.away_moneyline || game.away_ml),
      total: game.api_over_line || game.total_line,
    },
    weather: {
      temperature: game.weather_temp_f || game.temperature,
      wind_speed: game.weather_windspeed_mph || game.wind_speed,
      precipitation: game.precipitation,
      icon: game.weather_icon_text || game.icon_code,
    },
    public_betting: {
      spread_split: game.spread_splits_label,
      ml_split: game.ml_splits_label,
      total_split: game.total_splits_label,
    },
    line_movement: lineMovement,
    opening_lines: {
      opening_spread: game.opening_spread,
      opening_total: game.opening_total,
    },
    polymarket,
    model_predictions: {
      spread_cover_prob: spreadProb,
      ml_prob: game.pred_ml_proba || game.home_away_ml_prob,
      ou_prob: game.pred_total_proba || game.ou_result_prob,
      predicted_team: Number(spreadProb || 0) > 0.5 ? game.home_team : game.away_team,
    },
    game_data_complete: {
      source_table: 'cfb_live_weekly_inputs',
      raw_game_data: game,
    },
  };
}

function formatNBAGame(
  game: Record<string, unknown>,
  polymarket: Record<string, unknown> | null,
  awayInjuries: Record<string, unknown>[],
  homeInjuries: Record<string, unknown>[],
  predictionAccuracy: Record<string, unknown> | null,
  situationalTrends: Record<string, unknown> | null = null
): Record<string, unknown> {
  const gameId = String(game.game_id);
  const homeML = game.home_moneyline as number | null;
  let awayML = null;
  if (homeML) {
    awayML = homeML > 0 ? -(homeML + 100) : 100 - homeML;
  }
  const homeSpread = game.home_spread as number | null;
  const awaySpread = homeSpread !== null && homeSpread !== undefined ? -homeSpread : null;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date,
    game_time: game.tipoff_time_et,
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      ml_summary: `${game.away_team} ${fmtML(awayML) ?? 'N/A'} / ${game.home_team} ${fmtML(homeML) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(homeML),
      away_ml: fmtML(awayML),
      total: game.total_line,
    },
    team_stats: {
      home_pace: game.home_adj_pace ?? game.home_adj_pace_pregame,
      away_pace: game.away_adj_pace ?? game.away_adj_pace_pregame,
      home_offense: game.home_adj_offense ?? game.home_adj_off_rtg_pregame,
      away_offense: game.away_adj_offense ?? game.away_adj_off_rtg_pregame,
      home_defense: game.home_adj_defense ?? game.home_adj_def_rtg_pregame,
      away_defense: game.away_adj_defense ?? game.away_adj_def_rtg_pregame,
    },
    trends: {
      home_ats_pct: game.home_ats_pct,
      away_ats_pct: game.away_ats_pct,
      home_over_pct: game.home_over_pct,
      away_over_pct: game.away_over_pct,
    },
    injuries: {
      away_team: awayInjuries,
      home_team: homeInjuries,
    },
    situational_trends: filterSituationalTrends(situationalTrends),
    prediction_accuracy: predictionAccuracy,
    polymarket,
    game_data_complete: {
      source_table: 'nba_input_values_view',
      raw_game_data: filterNBARawGame(game),
    },
  };
}

function formatNCAABGame(
  game: Record<string, unknown>,
  polymarket: Record<string, unknown> | null,
  situationalTrends: Record<string, unknown> | null,
  predictionAccuracy: Record<string, unknown> | null
): Record<string, unknown> {
  const gameId = String(game.game_id);
  const homeSpread = game.spread as number | null;
  const awaySpread = homeSpread !== null && homeSpread !== undefined ? -homeSpread : null;

  return {
    game_id: gameId,
    matchup: `${game.away_team} @ ${game.home_team}`,
    away_team: game.away_team,
    home_team: game.home_team,
    game_date: game.game_date_et,
    game_time: game.start_utc || game.tipoff_time_et,
    conference_game: game.conference_game,
    neutral_site: game.neutral_site,
    vegas_lines: {
      spread_summary: `${game.away_team} ${fmtSpread(awaySpread)} / ${game.home_team} ${fmtSpread(homeSpread)}`,
      ml_summary: `${game.away_team} ${fmtML(game.awayMoneyline) ?? 'N/A'} / ${game.home_team} ${fmtML(game.homeMoneyline) ?? 'N/A'}`,
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: fmtML(game.homeMoneyline),
      away_ml: fmtML(game.awayMoneyline),
      total: game.over_under,
    },
    team_stats: {
      home_pace: game.home_adj_pace,
      away_pace: game.away_adj_pace,
      home_offense: game.home_adj_offense,
      away_offense: game.away_adj_offense,
      home_defense: game.home_adj_defense,
      away_defense: game.away_adj_defense,
      home_ranking: game.home_ranking,
      away_ranking: game.away_ranking,
    },
    situational_trends: filterSituationalTrends(situationalTrends),
    prediction_accuracy: predictionAccuracy,
    polymarket,
    game_data_complete: {
      source_table: 'v_cbb_input_values',
      raw_game_data: filterNCAABRawGame(game),
    },
  };
}
