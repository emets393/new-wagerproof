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

    const { data: promptRow, error: promptError } = await supabaseClient
      .from('agent_system_prompts')
      .select('prompt_text')
      .eq('is_active', true)
      .single();

    if (promptError || !promptRow) {
      console.warn('[auto-generate-avatar-picks] No active system prompt found, using hardcoded fallback');
    } else {
      remotePromptTemplate = promptRow.prompt_text;
      console.log('[auto-generate-avatar-picks] Loaded remote system prompt template');
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
      const { games, formattedGames } = await fetchGamesForSport(cfbClient, sport, today);
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
        remotePromptTemplate
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
  remotePromptTemplate: string | null
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

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: AVATAR_PICKS_JSON_SCHEMA,
        },
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error ${openaiResponse.status}: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();

    if (!openaiData.choices?.[0]?.message?.content) {
      throw new Error('Invalid OpenAI response structure');
    }

    // -------------------------------------------------------------------------
    // Parse and Validate Response
    // -------------------------------------------------------------------------
    const rawContent = openaiData.choices[0].message.content;
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
      let sportType: 'nfl' | 'cfb' | 'nba' | 'ncaab' = 'nfl';
      let matchup = '';

      for (const sd of allGamesData) {
        const foundGame = sd.games.find((g: unknown) => {
          const game = g as Record<string, unknown>;
          const gameId = game.training_key || game.unique_id || game.game_id || `${game.away_team}_${game.home_team}`;
          return String(gameId) === pick.game_id;
        });

        if (foundGame) {
          const game = foundGame as Record<string, unknown>;
          gameSnapshot = game;
          sportType = sd.sport as typeof sportType;
          matchup = `${game.away_team} @ ${game.home_team}`;
          break;
        }
      }

      // Build pick record matching the actual database schema
      const avatarPickRecord = {
        avatar_id: avatar.avatar_id,
        game_id: pick.game_id,
        sport: sportType,
        matchup: matchup || `Game ${pick.game_id}`,
        game_date: todayDate,
        bet_type: pick.bet_type,
        pick_selection: pick.selection,
        odds: pick.odds,
        units: 1.0,
        confidence: pick.confidence,
        reasoning_text: pick.reasoning,
        key_factors: pick.key_factors,
        archived_game_data: gameSnapshot,
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

// =============================================================================
// Game Fetching Functions (Reused from generate-avatar-picks)
// =============================================================================

interface GameFetchResult {
  games: unknown[];
  formattedGames: unknown[];
}

async function fetchGamesForSport(
  cfbClient: SupabaseClient,
  sport: string,
  targetDate: string
): Promise<GameFetchResult> {
  switch (sport) {
    case 'nfl':
      return fetchNFLGames(cfbClient);
    case 'cfb':
      return fetchCFBGames(cfbClient);
    case 'nba':
      return fetchNBAGames(cfbClient, targetDate);
    case 'ncaab':
      return fetchNCAABGames(cfbClient, targetDate);
    default:
      return { games: [], formattedGames: [] };
  }
}

async function fetchNFLGames(cfbClient: SupabaseClient): Promise<GameFetchResult> {
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

  const formattedGames = games.map(game => formatNFLGame(game));
  return { games, formattedGames };
}

async function fetchCFBGames(cfbClient: SupabaseClient): Promise<GameFetchResult> {
  const { data: games } = await cfbClient
    .from('cfb_live_weekly_inputs')
    .select('*');

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const formattedGames = games.map(game => formatCFBGame(game));
  return { games, formattedGames };
}

async function fetchNBAGames(
  cfbClient: SupabaseClient,
  targetDate: string
): Promise<GameFetchResult> {
  const { data: games } = await cfbClient
    .from('nba_input_values_view')
    .select('*')
    .eq('game_date', targetDate);

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const formattedGames = games.map(game => formatNBAGame(game));
  return { games, formattedGames };
}

async function fetchNCAABGames(
  cfbClient: SupabaseClient,
  targetDate: string
): Promise<GameFetchResult> {
  const { data: games } = await cfbClient
    .from('v_cbb_input_values')
    .select('*')
    .eq('game_date_et', targetDate);

  if (!games) {
    return { games: [], formattedGames: [] };
  }

  const formattedGames = games.map(game => formatNCAABGame(game));
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

function formatNFLGame(game: Record<string, unknown>): Record<string, unknown> {
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
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: game.home_ml,
      away_ml: game.away_ml,
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
    model_predictions: {
      spread_cover_prob: game.home_away_spread_cover_prob,
      ml_prob: game.home_away_ml_prob,
      ou_prob: game.ou_result_prob,
      predicted_team: Number(game.home_away_spread_cover_prob || 0) > 0.5 ? game.home_team : game.away_team,
    },
  };
}

function formatCFBGame(game: Record<string, unknown>): Record<string, unknown> {
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
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: game.home_moneyline || game.home_ml,
      away_ml: game.away_moneyline || game.away_ml,
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
    model_predictions: {
      spread_cover_prob: spreadProb,
      ml_prob: game.pred_ml_proba || game.home_away_ml_prob,
      ou_prob: game.pred_total_proba || game.ou_result_prob,
      predicted_team: Number(spreadProb || 0) > 0.5 ? game.home_team : game.away_team,
    },
  };
}

function formatNBAGame(game: Record<string, unknown>): Record<string, unknown> {
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
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: homeML,
      away_ml: awayML,
      total: game.total_line,
    },
    team_stats: {
      home_pace: game.home_adj_pace,
      away_pace: game.away_adj_pace,
      home_offense: game.home_adj_offense,
      away_offense: game.away_adj_offense,
      home_defense: game.home_adj_defense,
      away_defense: game.away_adj_defense,
    },
    trends: {
      home_ats_pct: game.home_ats_pct,
      away_ats_pct: game.away_ats_pct,
      home_over_pct: game.home_over_pct,
      away_over_pct: game.away_over_pct,
    },
  };
}

function formatNCAABGame(game: Record<string, unknown>): Record<string, unknown> {
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
      home_spread: homeSpread,
      away_spread: awaySpread,
      home_ml: game.homeMoneyline,
      away_ml: game.awayMoneyline,
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
  };
}
