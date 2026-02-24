import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { format } from 'https://esm.sh/date-fns@3.6.0';
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.0.0';

// =============================================================================
// Types
// =============================================================================

interface AvatarPick {
  id: string;
  avatar_id: string;
  game_id: string;
  sport: string;
  matchup: string;
  game_date: string;
  bet_type: 'spread' | 'moneyline' | 'total';
  pick_selection: string;
  odds: string | null;
  units: number;
  confidence: number;
  reasoning_text: string;
  key_factors: string[] | null;
  archived_game_data: Record<string, unknown>;
  result: 'won' | 'lost' | 'push' | 'pending';
  actual_result: string | null;
  graded_at: string | null;
}

interface GameResult {
  league: string;
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  ml_result: string | null;
  spread_result: string | null;
  ou_result: string | null;
}

interface ParsedSpreadPick {
  team: string;
  spread: number;
}

interface ParsedTotalPick {
  direction: 'over' | 'under';
  line: number;
}

interface GradingResult {
  pick_id: string;
  result: 'won' | 'lost' | 'push';
  actual_result: string;
}

interface GradingSummary {
  total_processed: number;
  won: number;
  lost: number;
  push: number;
  skipped: number;
  errors: number;
  skipped_reasons?: Record<string, number>;
}

// =============================================================================
// Constants
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// Date Utilities
// =============================================================================

function getTodayInET(): string {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

function incrementSkipReason(summary: GradingSummary, reason: string): void {
  if (!summary.skipped_reasons) {
    summary.skipped_reasons = {};
  }
  summary.skipped_reasons[reason] = (summary.skipped_reasons[reason] || 0) + 1;
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (str.length >= 10) return str.slice(0, 10);
  return str;
}

function normalizeTeamName(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bst[.]?\b/g, 'saint')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMatchup(matchup: string | null | undefined): { away: string; home: string } | null {
  if (!matchup) return null;
  const raw = String(matchup).trim();
  const separators = [' @ ', ' vs ', ' v ', ' at '];
  for (const sep of separators) {
    const parts = raw.split(sep);
    if (parts.length === 2) {
      return { away: parts[0].trim(), home: parts[1].trim() };
    }
  }
  return null;
}

function getArchivedTeamNames(archivedGameData: Record<string, unknown> | null | undefined): { away: string | null; home: string | null } {
  const obj = archivedGameData || {};
  const awayCandidates = [
    obj.away_team,
    (obj.game_data_complete as Record<string, unknown> | undefined)?.away_team,
    (obj.game_data_complete as Record<string, unknown> | undefined)?.raw_game_data &&
      ((obj.game_data_complete as Record<string, unknown>).raw_game_data as Record<string, unknown>).away_team,
  ];
  const homeCandidates = [
    obj.home_team,
    (obj.game_data_complete as Record<string, unknown> | undefined)?.home_team,
    (obj.game_data_complete as Record<string, unknown> | undefined)?.raw_game_data &&
      ((obj.game_data_complete as Record<string, unknown>).raw_game_data as Record<string, unknown>).home_team,
  ];

  const away = awayCandidates.find(v => typeof v === 'string' && v.trim()) as string | undefined;
  const home = homeCandidates.find(v => typeof v === 'string' && v.trim()) as string | undefined;
  return { away: away ?? null, home: home ?? null };
}

function isLikelyPushLine(value: number): boolean {
  // Whole-number lines can push; half-point hooks generally cannot.
  return Number.isInteger(value);
}

// =============================================================================
// Pick Selection Parsing
// =============================================================================

/**
 * Parse spread pick selection like "Bills -3" or "Chiefs +3.5"
 */
function parseSpreadPick(selection: string): ParsedSpreadPick | null {
  const match = selection.match(/^(.+?)\s*([+-]?\d+\.?\d*)$/);
  if (!match) {
    console.log(`[grade-avatar-picks] Could not parse spread selection: ${selection}`);
    return null;
  }
  return {
    team: match[1].trim(),
    spread: parseFloat(match[2]),
  };
}

/**
 * Parse total pick selection like "Over 48.5" or "Under 48.5"
 */
function parseTotalPick(selection: string): ParsedTotalPick | null {
  const match = selection.match(/^(over|under)\s+(\d+\.?\d*)$/i);
  if (!match) {
    console.log(`[grade-avatar-picks] Could not parse total selection: ${selection}`);
    return null;
  }
  return {
    direction: match[1].toLowerCase() as 'over' | 'under',
    line: parseFloat(match[2]),
  };
}

/**
 * Parse moneyline pick selection like "Bills -150" or "Bills ML"
 * Returns the team name
 */
function parseMoneylinePick(selection: string): string | null {
  let cleaned = selection.replace(/\s*ML$/i, '').trim();
  cleaned = cleaned.replace(/\s*[+-]\d+$/, '').trim();
  if (!cleaned) {
    console.log(`[grade-avatar-picks] Could not parse moneyline selection: ${selection}`);
    return null;
  }
  return cleaned;
}

// =============================================================================
// Game Results from all_game_results View (CFB Supabase)
// =============================================================================

/**
 * Fetch pre-computed game results from the all_game_results view.
 * Returns a Map keyed by game_id for O(1) lookup.
 */
async function fetchGameResults(
  cfbClient: SupabaseClient,
  league: string,
  gameDates: string[]
): Promise<Map<string, GameResult>> {
  const results = new Map<string, GameResult>();
  if (gameDates.length === 0) return results;

  const { data, error } = await cfbClient
    .from('all_game_results')
    .select('*')
    .eq('league', league.toUpperCase())
    .in('game_date', gameDates);

  if (error) {
    console.error(`[grade-avatar-picks] Error fetching game results for ${league}:`, error);
    return results;
  }

  for (const row of data || []) {
    results.set(row.game_id, row as GameResult);
  }

  console.log(`[grade-avatar-picks] Fetched ${results.size} ${league.toUpperCase()} game results for dates: ${gameDates.join(', ')}`);
  return results;
}

// =============================================================================
// Team Name Resolution
// =============================================================================

/**
 * Resolve an abbreviated team name from pick_selection (e.g., "Lakers") to the
 * canonical full name from the view (e.g., "Los Angeles Lakers").
 *
 * Strategy:
 *   1. Direct match against home_team / away_team
 *   2. Substring match (either direction)
 *   3. Matchup fallback — parse "Away @ Home" and substring-match
 */
function resolveCanonicalTeamName(
  pickedTeam: string,
  gameResult: GameResult,
  matchup: string | null,
  archivedGameData: Record<string, unknown> | null
): string | null {
  const picked = normalizeTeamName(pickedTeam);
  const home = normalizeTeamName(gameResult.home_team);
  const away = normalizeTeamName(gameResult.away_team);
  if (!picked) return null;

  // Direct match
  if (picked === home) return gameResult.home_team;
  if (picked === away) return gameResult.away_team;

  // Substring match, but avoid ambiguous two-sided matches.
  const homeContains = home.includes(picked) || picked.includes(home);
  const awayContains = away.includes(picked) || picked.includes(away);
  if (homeContains && !awayContains) return gameResult.home_team;
  if (awayContains && !homeContains) return gameResult.away_team;

  // Matchup fallback: infer side first, then map to canonical game-result side.
  if (matchup) {
    const parsed = parseMatchup(matchup);
    if (parsed) {
      const matchupAway = normalizeTeamName(parsed.away);
      const matchupHome = normalizeTeamName(parsed.home);
      const homeSideMatch = matchupHome.includes(picked) || picked.includes(matchupHome);
      const awaySideMatch = matchupAway.includes(picked) || picked.includes(matchupAway);
      if (homeSideMatch && !awaySideMatch) {
        return gameResult.home_team;
      }
      if (awaySideMatch && !homeSideMatch) {
        return gameResult.away_team;
      }
    }
  }

  // Archived game data fallback (exact game context at pick time).
  const archivedTeams = getArchivedTeamNames(archivedGameData);
  const archivedAway = normalizeTeamName(archivedTeams.away);
  const archivedHome = normalizeTeamName(archivedTeams.home);
  const archivedHomeMatch = archivedHome && (archivedHome.includes(picked) || picked.includes(archivedHome));
  const archivedAwayMatch = archivedAway && (archivedAway.includes(picked) || picked.includes(archivedAway));
  if (archivedHomeMatch && !archivedAwayMatch) return gameResult.home_team;
  if (archivedAwayMatch && !archivedHomeMatch) return gameResult.away_team;

  console.log(`[grade-avatar-picks] Could not resolve "${pickedTeam}" to canonical name for ${gameResult.away_team} @ ${gameResult.home_team}`);
  return null;
}

// =============================================================================
// Pick Grading Using View's Pre-Computed Results
// =============================================================================

/**
 * Grade a single pick using the view's ml_result, spread_result, ou_result.
 * Returns null if the game isn't final yet (result columns are null).
 */
function gradePickFromView(
  pick: AvatarPick,
  gameResult: GameResult
): { result: 'won' | 'lost' | 'push'; actual_result: string } | null {
  const actualResultPrefix = `${gameResult.away_team} vs ${gameResult.home_team}`;

  switch (pick.bet_type) {
    case 'moneyline': {
      if (!gameResult.ml_result) return null;

      const pickedTeam = parseMoneylinePick(pick.pick_selection);
      if (!pickedTeam) return null;

      const canonical = resolveCanonicalTeamName(pickedTeam, gameResult, pick.matchup, pick.archived_game_data);
      if (!canonical) return null;

      const result = canonical === gameResult.ml_result ? 'won' : 'lost';
      return {
        result,
        actual_result: `${actualResultPrefix} — ML winner: ${gameResult.ml_result}`,
      };
    }

    case 'spread': {
      if (!gameResult.spread_result) return null;

      const parsed = parseSpreadPick(pick.pick_selection);
      if (!parsed) return null;

      const canonical = resolveCanonicalTeamName(parsed.team, gameResult, pick.matchup, pick.archived_game_data);
      if (!canonical) return null;

      let result: 'won' | 'lost' | 'push';
      if (gameResult.spread_result.toUpperCase() === 'PUSH') {
        if (!isLikelyPushLine(parsed.spread)) {
          console.log(`[grade-avatar-picks] Skipping impossible spread push for hook line: ${pick.pick_selection} (${pick.id})`);
          return null;
        }
        result = 'push';
      } else if (canonical === gameResult.spread_result) {
        result = 'won';
      } else {
        result = 'lost';
      }

      return {
        result,
        actual_result: `${actualResultPrefix} — Spread: ${gameResult.spread_result}`,
      };
    }

    case 'total': {
      if (!gameResult.ou_result) return null;

      const parsed = parseTotalPick(pick.pick_selection);
      if (!parsed) return null;

      const ouResult = gameResult.ou_result.toLowerCase();
      let result: 'won' | 'lost' | 'push';
      if (ouResult === 'push') {
        if (!isLikelyPushLine(parsed.line)) {
          console.log(`[grade-avatar-picks] Skipping impossible total push for hook line: ${pick.pick_selection} (${pick.id})`);
          return null;
        }
        result = 'push';
      } else if (ouResult === parsed.direction) {
        result = 'won';
      } else {
        result = 'lost';
      }

      return {
        result,
        actual_result: `${actualResultPrefix} — Total: ${gameResult.ou_result}`,
      };
    }

    default:
      console.error(`[grade-avatar-picks] Unknown bet type: ${pick.bet_type}`);
      return null;
  }
}

// =============================================================================
// Game Lookup
// =============================================================================

/**
 * Find a GameResult for a pick. Tries game_id first, then falls back to
 * matching by game_date + team names parsed from the matchup string.
 */
function findGameResult(
  pick: AvatarPick,
  resultsMap: Map<string, GameResult>,
  allResults: GameResult[]
): GameResult | null {
  // Primary: lookup by game_id
  if (resultsMap.has(pick.game_id)) {
    return resultsMap.get(pick.game_id)!;
  }

  const pickDate = toDateOnly(pick.game_date);
  const parsedMatchup = parseMatchup(pick.matchup);
  const archivedTeams = getArchivedTeamNames(pick.archived_game_data);
  const rawAway = normalizeTeamName(parsedMatchup?.away ?? archivedTeams.away);
  const rawHome = normalizeTeamName(parsedMatchup?.home ?? archivedTeams.home);

  // Fallback: match by game_date + robust team-name normalization.
  if (rawAway && rawHome && pickDate) {
    for (const result of allResults) {
      const resultDate = toDateOnly(result.game_date);
      if (!resultDate || resultDate !== pickDate) continue;

      const resultAway = normalizeTeamName(result.away_team);
      const resultHome = normalizeTeamName(result.home_team);

      const homeMatch = resultHome.includes(rawHome) || rawHome.includes(resultHome);
      const awayMatch = resultAway.includes(rawAway) || rawAway.includes(resultAway);

      if (homeMatch && awayMatch) {
        console.log(`[grade-avatar-picks] Matched pick ${pick.id} by team/date fallback: ${pick.matchup}`);
        return result;
      }
    }
  }

  console.log(`[grade-avatar-picks] No game result found for pick ${pick.id} (${pick.matchup}, game_id: ${pick.game_id})`);
  return null;
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[grade-avatar-picks] Starting pick grading...');

  try {
    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = Boolean((body as Record<string, unknown> | null)?.dry_run);
    } catch {
      // Allow empty or non-JSON cron requests.
    }
    if (dryRun) {
      console.log('[grade-avatar-picks] Running in DRY RUN mode (no DB writes)');
    }

    // Initialize Main Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize CFB Supabase client (hosts all_game_results view)
    const cfbSupabaseUrl = Deno.env.get('CFB_SUPABASE_URL') ?? '';
    const cfbSupabaseKey = Deno.env.get('CFB_SUPABASE_ANON_KEY') ?? '';
    const cfbClient = (cfbSupabaseUrl && cfbSupabaseKey)
      ? createClient(cfbSupabaseUrl, cfbSupabaseKey)
      : null;

    if (!cfbClient) {
      console.warn('[grade-avatar-picks] CFB Supabase not configured — all picks will stay pending');
      return new Response(
        JSON.stringify({
          success: true,
          summary: { total_processed: 0, won: 0, lost: 0, push: 0, skipped: 0, errors: 0 },
          avatars_updated: [],
          details: [],
          warning: 'CFB Supabase not configured',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = getTodayInET();
    console.log(`[grade-avatar-picks] Today (ET): ${today}`);

    // -------------------------------------------------------------------------
    // 1. Fetch pending picks — NBA and NCAAB only
    //    (NFL/CFB seasons are over; view doesn't cover them yet)
    // -------------------------------------------------------------------------
    const { data: pendingPicks, error: fetchError } = await supabase
      .from('avatar_picks')
      .select('*')
      .eq('result', 'pending')
      .lte('game_date', today)
      .in('sport', ['nba', 'ncaab']);

    if (fetchError) {
      throw new Error(`Failed to fetch pending picks: ${fetchError.message}`);
    }

    if (!pendingPicks || pendingPicks.length === 0) {
      console.log('[grade-avatar-picks] No pending NBA/NCAAB picks to grade');
      return new Response(
        JSON.stringify({
          success: true,
          summary: { total_processed: 0, won: 0, lost: 0, push: 0, skipped: 0, errors: 0 },
          avatars_updated: [],
          details: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[grade-avatar-picks] Found ${pendingPicks.length} pending NBA/NCAAB picks to process`);

    // -------------------------------------------------------------------------
    // 2. Collect unique game dates per league and batch fetch results
    // -------------------------------------------------------------------------
    const nbaDates = new Set<string>();
    const ncaabDates = new Set<string>();

    for (const pick of pendingPicks) {
      if (pick.sport === 'nba') nbaDates.add(pick.game_date);
      else if (pick.sport === 'ncaab') ncaabDates.add(pick.game_date);
    }

    const [nbaResults, ncaabResults] = await Promise.all([
      nbaDates.size > 0
        ? fetchGameResults(cfbClient, 'NBA', [...nbaDates])
        : Promise.resolve(new Map<string, GameResult>()),
      ncaabDates.size > 0
        ? fetchGameResults(cfbClient, 'NCAAB', [...ncaabDates])
        : Promise.resolve(new Map<string, GameResult>()),
    ]);

    const resultsByLeague: Record<string, { map: Map<string, GameResult>; all: GameResult[] }> = {
      nba: { map: nbaResults, all: [...nbaResults.values()] },
      ncaab: { map: ncaabResults, all: [...ncaabResults.values()] },
    };

    // -------------------------------------------------------------------------
    // 3. Grade each pick
    // -------------------------------------------------------------------------
    const summary: GradingSummary = {
      total_processed: 0,
      won: 0,
      lost: 0,
      push: 0,
      skipped: 0,
      errors: 0,
    };
    const gradedDetails: GradingResult[] = [];
    const affectedAvatars = new Set<string>();

    for (const pick of pendingPicks as AvatarPick[]) {
      summary.total_processed++;

      try {
        const leagueData = resultsByLeague[pick.sport];
        if (!leagueData) {
          summary.skipped++;
          incrementSkipReason(summary, 'unsupported_sport');
          continue;
        }

        const gameResult = findGameResult(pick, leagueData.map, leagueData.all);
        if (!gameResult) {
          summary.skipped++;
          incrementSkipReason(summary, 'game_not_found');
          continue;
        }

        const grading = gradePickFromView(pick, gameResult);
        if (!grading) {
          console.log(`[grade-avatar-picks] Skipping pick ${pick.id} — game not final or parse error`);
          summary.skipped++;
          incrementSkipReason(summary, 'not_final_or_parse_or_ambiguous');
          continue;
        }

        // Update the pick in database
        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('avatar_picks')
            .update({
              result: grading.result,
              actual_result: grading.actual_result,
              graded_at: new Date().toISOString(),
            })
            .eq('id', pick.id);

          if (updateError) {
            console.error(`[grade-avatar-picks] Failed to update pick ${pick.id}:`, updateError);
            summary.errors++;
            continue;
          }
        }

        summary[grading.result]++;
        affectedAvatars.add(pick.avatar_id);
        gradedDetails.push({
          pick_id: pick.id,
          result: grading.result,
          actual_result: grading.actual_result,
        });

        console.log(`[grade-avatar-picks] Graded pick ${pick.id}: ${grading.result} (${grading.actual_result})`);

      } catch (error) {
        console.error(`[grade-avatar-picks] Error grading pick ${pick.id}:`, error);
        summary.errors++;
      }
    }

    // -------------------------------------------------------------------------
    // 4. Recalculate performance for affected avatars
    // -------------------------------------------------------------------------
    const avatarsUpdated: string[] = [];

    for (const avatarId of affectedAvatars) {
      if (dryRun) {
        avatarsUpdated.push(avatarId);
        continue;
      }
      try {
        const { error: recalcError } = await supabase.rpc('recalculate_avatar_performance', {
          p_avatar_id: avatarId,
        });

        if (recalcError) {
          console.error(`[grade-avatar-picks] Failed to recalculate performance for avatar ${avatarId}:`, recalcError);
        } else {
          avatarsUpdated.push(avatarId);
          console.log(`[grade-avatar-picks] Recalculated performance for avatar ${avatarId}`);
        }
      } catch (error) {
        console.error(`[grade-avatar-picks] Error recalculating avatar ${avatarId}:`, error);
      }
    }

    // -------------------------------------------------------------------------
    // 5. Return summary
    // -------------------------------------------------------------------------
    const duration = Date.now() - startTime;
    console.log(`[grade-avatar-picks] Completed in ${duration}ms`);
    console.log(`[grade-avatar-picks] Summary: ${JSON.stringify(summary)}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        avatars_updated: avatarsUpdated,
        details: gradedDetails,
        dry_run: dryRun,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[grade-avatar-picks] Unhandled error:', error);
    console.error('[grade-avatar-picks] Stack:', (error as Error).stack);

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
