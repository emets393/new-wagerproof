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

  const [polymarketByGameKey, injuriesByTeam, accuracyByGameId] = await Promise.all([
    fetchPolymarketByGameKey(mainClient, 'nba', games),
    fetchNBAInjuriesByTeam(cfbClient, games, targetDate),
    fetchPredictionAccuracyByGameId(cfbClient, 'nba_todays_games_predictions_with_accuracy', games, targetDate, true),
  ]);

  const formattedGames = games.map(game =>
    formatNBAGame(
      game,
      polymarketByGameKey.get(toGameKey('nba', game.away_team, game.home_team)) || null,
      injuriesByTeam.get(normalizeTeamKey(game.away_team)) || [],
      injuriesByTeam.get(normalizeTeamKey(game.home_team)) || [],
      accuracyByGameId.get(String(game.game_id || '')) || null
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
    fetchNCAABSituationalTrendsByGameId(cfbClient, games),
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

async function fetchNCAABSituationalTrendsByGameId(
  cfbClient: SupabaseClient,
  games: Record<string, unknown>[]
): Promise<Map<string, Record<string, unknown>>> {
  const gameIds = [...new Set(games.map(g => String(g.game_id || '')).filter(Boolean))];
  const result = new Map<string, Record<string, unknown>>();
  if (gameIds.length === 0) return result;

  try {
    const { data, error } = await cfbClient
      .from('ncaab_game_situational_trends_today')
      .select('*')
      .in('game_id', gameIds);

    if (error || !data) {
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const gameId = String(row.game_id || '');
      if (gameId) result.set(gameId, row);
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
  predictionAccuracy: Record<string, unknown> | null
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
    injuries: {
      away_team: awayInjuries,
      home_team: homeInjuries,
    },
    prediction_accuracy: predictionAccuracy,
    polymarket,
    game_data_complete: {
      source_table: 'nba_input_values_view',
      raw_game_data: game,
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
    situational_trends: situationalTrends,
    prediction_accuracy: predictionAccuracy,
    polymarket,
    game_data_complete: {
      source_table: 'v_cbb_input_values',
      raw_game_data: game,
    },
  };
}
