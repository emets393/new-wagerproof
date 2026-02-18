import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import {
  GeneratePicksRequestSchema,
  AIResponseSchema,
  AVATAR_PICKS_JSON_SCHEMA,
  type AvatarProfile,
  type AvatarPick,
  type GeneratedPick,
} from './pickSchema.ts';

import {
  buildSystemPrompt,
  buildUserPrompt,
  getMaxPicks,
} from './promptBuilder.ts';

// =============================================================================
// Constants
// =============================================================================

const MAX_DAILY_GENERATIONS = 3;
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

  try {
    // ---------------------------------------------------------------------
    // 1. Parse and Validate Request
    // ---------------------------------------------------------------------
    const body = await req.json();
    const parseResult = GeneratePicksRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(400, 'Invalid request', parseResult.error.errors);
    }

    const { avatar_id, user_id, is_admin } = parseResult.data;

    console.log(`[generate-avatar-picks] Starting generation for avatar ${avatar_id} by user ${user_id}`);

    // ---------------------------------------------------------------------
    // 2. Initialize Supabase Clients
    // ---------------------------------------------------------------------
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

    // ---------------------------------------------------------------------
    // 3. Fetch and Validate Avatar Profile
    // ---------------------------------------------------------------------
    const { data: profile, error: profileError } = await supabaseClient
      .from('avatar_profiles')
      .select('*')
      .eq('id', avatar_id)
      .single();

    if (profileError || !profile) {
      console.error('[generate-avatar-picks] Profile fetch error:', profileError);
      return errorResponse(404, 'Avatar not found');
    }

    // Verify user owns this avatar or it's public
    if (profile.user_id !== user_id && !profile.is_public) {
      return errorResponse(403, 'Not authorized to generate picks for this avatar');
    }

    const avatarProfile = profile as AvatarProfile;
    console.log(`[generate-avatar-picks] Found avatar: ${avatarProfile.name} (${avatarProfile.avatar_emoji})`);
    console.log(`[generate-avatar-picks] Preferred sports: ${JSON.stringify(avatarProfile.preferred_sports)}`);

    // ---------------------------------------------------------------------
    // 4. Daily Generation Limit Check
    // ---------------------------------------------------------------------
    // Use US Eastern time for consistency with game dates
    const todayDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })).toISOString().split('T')[0];
    let currentGenCount = avatarProfile.daily_generation_count || 0;

    // Reset count if date has changed
    if (avatarProfile.last_generation_date !== todayDate) {
      currentGenCount = 0;
    }

    if (currentGenCount >= MAX_DAILY_GENERATIONS && !is_admin) {
      console.log(`[generate-avatar-picks] Daily limit reached: ${currentGenCount}/${MAX_DAILY_GENERATIONS}`);
      return errorResponse(429, 'Daily generation limit reached', {
        daily_limit: MAX_DAILY_GENERATIONS,
        generations_used: currentGenCount,
        resets_at: `${todayDate}T00:00:00Z (next day)`,
      });
    }

    // ---------------------------------------------------------------------
    // 5. Fetch Active System Prompt from Database
    // ---------------------------------------------------------------------
    let remotePromptTemplate: string | null = null;

    const { data: promptRow, error: promptError } = await supabaseClient
      .from('agent_system_prompts')
      .select('prompt_text')
      .eq('is_active', true)
      .single();

    if (promptError || !promptRow) {
      console.warn('[generate-avatar-picks] No active system prompt found, using hardcoded fallback');
    } else {
      remotePromptTemplate = promptRow.prompt_text;
      console.log('[generate-avatar-picks] Loaded remote system prompt template');
    }

    // ---------------------------------------------------------------------
    // 6. Fetch Today's Games for Preferred Sports
    // ---------------------------------------------------------------------
    // Use US Eastern time for date since game dates are stored in ET
    const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const today = nowET.toISOString().split('T')[0];
    console.log(`[generate-avatar-picks] Querying games for date: ${today} (ET)`);

    const allGamesData: { sport: string; games: unknown[]; formattedGames: unknown[] }[] = [];

    for (const sport of avatarProfile.preferred_sports) {
      const { games, formattedGames } = await fetchGamesForSport(cfbClient, supabaseClient, sport, today);
      console.log(`[generate-avatar-picks] ${sport.toUpperCase()}: ${games.length} games found`);
      if (games.length > 0) {
        allGamesData.push({ sport, games, formattedGames });
      }
    }

    // Calculate total games
    const totalGames = allGamesData.reduce((sum, sd) => sum + sd.games.length, 0);
    console.log(`[generate-avatar-picks] Total games across all sports: ${totalGames}`);

    // ---------------------------------------------------------------------
    // 7. Apply Weak Slate Logic
    // ---------------------------------------------------------------------
    if (totalGames < MIN_GAMES_FOR_SLATE && avatarProfile.personality_params.skip_weak_slates) {
      console.log('[generate-avatar-picks] Weak slate detected, skipping generation');

      // Update last_generated_at even on skip to prevent spam
      await supabaseClient
        .from('avatar_profiles')
        .update({ last_generated_at: new Date().toISOString() })
        .eq('id', avatar_id);

      return new Response(
        JSON.stringify({
          success: true,
          picks: [],
          slate_note: `Today's slate only has ${totalGames} games across your preferred sports. Per your settings, skipping weak slates.`,
          games_analyzed: totalGames,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle no games at all
    if (totalGames === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          picks: [],
          slate_note: 'No games found for your preferred sports today.',
          games_analyzed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---------------------------------------------------------------------
    // 8. Build AI Prompt
    // ---------------------------------------------------------------------
    const systemPrompt = buildSystemPrompt(
      avatarProfile,
      avatarProfile.preferred_sports,
      remotePromptTemplate
    );

    // Combine all formatted games with sport labels
    const combinedGames = allGamesData.flatMap(sd =>
      sd.formattedGames.map(game => ({
        ...game as Record<string, unknown>,
        sport: sd.sport.toUpperCase(),
      }))
    );

    const userPrompt = buildUserPrompt(combinedGames, 'MULTI', today);

    console.log('[generate-avatar-picks] System prompt length:', systemPrompt.length);
    console.log('[generate-avatar-picks] User prompt length:', userPrompt.length);

    // ---------------------------------------------------------------------
    // 8. Call OpenAI
    // ---------------------------------------------------------------------
    console.log('[generate-avatar-picks] Calling OpenAI...');

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
      console.error('[generate-avatar-picks] OpenAI error status:', openaiResponse.status);
      console.error('[generate-avatar-picks] OpenAI error body:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText.substring(0, 500)}`);
    }

    const openaiData = await openaiResponse.json();

    if (!openaiData.choices?.[0]?.message?.content) {
      throw new Error('Invalid OpenAI response structure');
    }

    const rawContent = openaiData.choices[0].message.content;
    console.log('[generate-avatar-picks] OpenAI response received, length:', rawContent.length);

    // ---------------------------------------------------------------------
    // 9. Validate AI Response
    // ---------------------------------------------------------------------
    let aiResponse;
    try {
      aiResponse = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('[generate-avatar-picks] JSON parse error:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    const validationResult = AIResponseSchema.safeParse(aiResponse);

    if (!validationResult.success) {
      console.error('[generate-avatar-picks] Validation errors:', validationResult.error.errors);
      // Continue with partial data if picks array exists
      if (!aiResponse.picks || !Array.isArray(aiResponse.picks)) {
        throw new Error('AI response missing picks array');
      }
    }

    const picks = aiResponse.picks as GeneratedPick[];
    const slateNote = aiResponse.slate_note as string | undefined;

    console.log(`[generate-avatar-picks] AI generated ${picks.length} picks`);

    // Enforce max picks limit
    const maxPicks = getMaxPicks(avatarProfile.personality_params.max_picks_per_day);
    const limitedPicks = picks.slice(0, maxPicks);

    if (picks.length > maxPicks) {
      console.log(`[generate-avatar-picks] Trimmed picks from ${picks.length} to ${maxPicks}`);
    }

    // ---------------------------------------------------------------------
    // 10. Build Game Snapshots and Insert Picks
    // ---------------------------------------------------------------------
    const now = new Date().toISOString();
    const insertedPicks: AvatarPick[] = [];

    for (const pick of limitedPicks) {
      // Find the original game data for snapshot
      let gameSnapshot: Record<string, unknown> = {};
      let sportType: 'nfl' | 'cfb' | 'nba' | 'ncaab' = 'nfl';
      let matchup = '';
      let gameDate = today;

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
          gameDate = String(game.game_date || game.game_date_et || game.start_date || today);
          break;
        }
      }

      // Calculate units based on confidence (1-5 maps to 0.5-2.0 units)
      const unitsByConfidence: Record<number, number> = { 1: 0.5, 2: 0.75, 3: 1.0, 4: 1.5, 5: 2.0 };
      const units = unitsByConfidence[pick.confidence] || 1.0;

      // Build pick object matching database schema
      const avatarPick = {
        avatar_id,
        game_id: pick.game_id,
        sport: sportType,  // Database column is 'sport', not 'sport_type'
        matchup,
        game_date: gameDate,
        bet_type: pick.bet_type,
        pick_selection: pick.selection,  // Database column is 'pick_selection'
        odds: pick.odds,
        units,
        confidence: pick.confidence,
        reasoning_text: pick.reasoning,  // Database column is 'reasoning_text'
        key_factors: pick.key_factors,
        archived_game_data: gameSnapshot,  // Database column is 'archived_game_data'
        archived_personality: avatarProfile.personality_params,  // Required column
        result: 'pending',  // Default to pending
      };

      insertedPicks.push(avatarPick as AvatarPick);
    }

    // Delete existing picks for today before inserting new ones (regeneration)
    // Delete by avatar_id + game_date to clear today's picks, AND by the specific
    // game_ids being inserted (to handle games with different dates like NFL)
    const newGameIds = insertedPicks.map(p => p.game_id);

    const { error: deleteError } = await supabaseClient
      .from('avatar_picks')
      .delete()
      .eq('avatar_id', avatar_id)
      .or(`game_date.eq.${today},game_id.in.(${newGameIds.join(',')})`);

    if (deleteError) {
      console.error('[generate-avatar-picks] Delete existing picks error:', deleteError);
      // Non-fatal: continue with upsert even if delete fails
    } else {
      console.log(`[generate-avatar-picks] Cleared existing picks for ${today} and ${newGameIds.length} game IDs`);
    }

    // Upsert picks (handles any remaining constraint conflicts gracefully)
    if (insertedPicks.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('avatar_picks')
        .upsert(insertedPicks, { onConflict: 'avatar_id,game_id,bet_type' });

      if (insertError) {
        console.error('[generate-avatar-picks] Upsert error:', insertError);
        throw new Error(`Failed to save picks: ${insertError.message}`);
      }

      console.log(`[generate-avatar-picks] Upserted ${insertedPicks.length} picks`);
    }

    // ---------------------------------------------------------------------
    // 11. Update Avatar Timestamps and Generation Count
    // ---------------------------------------------------------------------
    const newGenCount = currentGenCount + 1;
    const { error: updateError } = await supabaseClient
      .from('avatar_profiles')
      .update({
        last_generated_at: now,
        updated_at: now,
        daily_generation_count: newGenCount,
        last_generation_date: todayDate,
      })
      .eq('id', avatar_id);

    if (updateError) {
      console.error('[generate-avatar-picks] Update error:', updateError);
      // Non-fatal, continue
    }

    // ---------------------------------------------------------------------
    // 12. Return Response
    // ---------------------------------------------------------------------
    console.log('[generate-avatar-picks] Generation complete');

    return new Response(
      JSON.stringify({
        success: true,
        picks: insertedPicks,
        slate_note: slateNote,
        games_analyzed: totalGames,
        tokens_used: openaiData.usage?.total_tokens || 0,
        daily_generation_count: newGenCount,
        daily_limit: MAX_DAILY_GENERATIONS,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-avatar-picks] Unhandled error:', error);
    console.error('[generate-avatar-picks] Stack:', (error as Error).stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'Unknown error',
        errorType: (error as Error).constructor.name,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function errorResponse(
  status: number,
  message: string,
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      details,
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// =============================================================================
// Game Fetching Functions
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
// Game Formatting Functions
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
      console.warn(`[generate-avatar-picks] Polymarket fetch failed for ${sport}:`, error?.message || 'No data');
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
    console.warn(`[generate-avatar-picks] Polymarket fetch threw for ${sport}:`, (error as Error).message);
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
      console.warn(`[generate-avatar-picks] Line movement fetch failed (${tableName}):`, error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const key = String(row.training_key || '');
      if (!result.has(key)) result.set(key, []);
      result.get(key)?.push(row);
    }
  } catch (error) {
    console.warn(`[generate-avatar-picks] Line movement fetch threw (${tableName}):`, (error as Error).message);
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
      console.warn(`[generate-avatar-picks] NFL H2H fetch failed for ${away} @ ${home}:`, (error as Error).message);
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
      console.warn('[generate-avatar-picks] NBA injury fetch failed:', error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const teamKey = normalizeTeamKey(row.team_name);
      if (!result.has(teamKey)) result.set(teamKey, []);
      result.get(teamKey)?.push(row);
    }
  } catch (error) {
    console.warn('[generate-avatar-picks] NBA injury fetch threw:', (error as Error).message);
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
      console.warn(`[generate-avatar-picks] ${tableName} fetch failed:`, error?.message || 'No data');
      return result;
    }

    for (const row of data as Record<string, unknown>[]) {
      const gameId = String(row.game_id || '');
      if (gameId) result.set(gameId, row);
    }
  } catch (error) {
    console.warn(`[generate-avatar-picks] ${tableName} fetch threw:`, (error as Error).message);
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
