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

interface LiveScore {
  game_id: string;
  league: string;
  away_team: string;
  away_abbr: string;
  away_score: number;
  home_team: string;
  home_abbr: string;
  home_score: number;
  status: string;
  is_live: boolean;
}

interface ESPNGame {
  id: string;
  status: {
    type: {
      name: string;
      state: string;
      completed: boolean;
      description: string;
    };
  };
  competitors: Array<{
    team: {
      displayName: string;
      abbreviation: string;
    };
    score: string;
    homeAway: 'home' | 'away';
  }>;
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
}

// =============================================================================
// Constants
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ESPN_ENDPOINTS: Record<string, string> = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  cfb: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  ncaab: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
};

// =============================================================================
// Date Utilities
// =============================================================================

function getTodayInET(): string {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

// =============================================================================
// Pick Selection Parsing
// =============================================================================

/**
 * Parse spread pick selection like "Bills -3" or "Chiefs +3"
 * Returns the team name and spread number
 */
function parseSpreadPick(selection: string): ParsedSpreadPick | null {
  // Match patterns like "Bills -3", "Chiefs +3.5", "Kansas City Chiefs -7"
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
 * Parse moneyline pick selection like "Bills -150" or "Chiefs +130" or "Bills ML"
 * Returns the team name
 */
function parseMoneylinePick(selection: string): string | null {
  // Remove "ML" suffix if present
  let cleaned = selection.replace(/\s*ML$/i, '').trim();

  // Remove odds suffix like "-150" or "+130"
  cleaned = cleaned.replace(/\s*[+-]\d+$/, '').trim();

  if (!cleaned) {
    console.log(`[grade-avatar-picks] Could not parse moneyline selection: ${selection}`);
    return null;
  }

  return cleaned;
}

// =============================================================================
// Team Matching
// =============================================================================

/**
 * Check if two team names match (handles abbreviations, nicknames, etc.)
 */
function teamsMatch(pickTeam: string, scoreTeam: string, scoreAbbr: string): boolean {
  const pickLower = pickTeam.toLowerCase().trim();
  const teamLower = scoreTeam.toLowerCase().trim();
  const abbrLower = scoreAbbr.toLowerCase().trim();

  // Direct match
  if (pickLower === teamLower || pickLower === abbrLower) {
    return true;
  }

  // Check if pick team is contained in full team name (e.g., "Bills" in "Buffalo Bills")
  if (teamLower.includes(pickLower) || pickLower.includes(teamLower)) {
    return true;
  }

  // Check if pick team contains the abbreviation
  if (pickLower.includes(abbrLower) || abbrLower.includes(pickLower)) {
    return true;
  }

  // Common city/team mappings
  const teamMappings: Record<string, string[]> = {
    // NFL
    'buf': ['bills', 'buffalo'],
    'kc': ['chiefs', 'kansas city'],
    'ne': ['patriots', 'new england'],
    'nyj': ['jets', 'new york jets'],
    'nyg': ['giants', 'new york giants'],
    'lac': ['chargers', 'los angeles chargers', 'la chargers'],
    'lar': ['rams', 'los angeles rams', 'la rams'],
    'lv': ['raiders', 'las vegas'],
    'sf': ['49ers', 'niners', 'san francisco'],
    'tb': ['buccaneers', 'bucs', 'tampa bay'],
    'gb': ['packers', 'green bay'],
    'no': ['saints', 'new orleans'],
    // NBA
    'gsw': ['warriors', 'golden state'],
    'lac': ['clippers', 'la clippers'],
    'lal': ['lakers', 'la lakers'],
    'nyk': ['knicks', 'new york knicks'],
    'bkn': ['nets', 'brooklyn'],
    'okc': ['thunder', 'oklahoma city'],
    'por': ['blazers', 'trail blazers', 'portland'],
    'sas': ['spurs', 'san antonio'],
    'phx': ['suns', 'phoenix'],
    'uta': ['jazz', 'utah'],
    'mem': ['grizzlies', 'memphis'],
    'min': ['timberwolves', 'wolves', 'minnesota'],
    'den': ['nuggets', 'denver'],
    'mia': ['heat', 'miami'],
    'bos': ['celtics', 'boston'],
    'phi': ['76ers', 'sixers', 'philadelphia'],
    'mil': ['bucks', 'milwaukee'],
  };

  // Check mappings
  for (const [abbr, names] of Object.entries(teamMappings)) {
    if (abbrLower === abbr || names.some(n => pickLower.includes(n) || n.includes(pickLower))) {
      if (names.some(n => teamLower.includes(n) || abbrLower === abbr)) {
        return true;
      }
    }
  }

  return false;
}

// =============================================================================
// Grading Logic
// =============================================================================

/**
 * Grade a spread bet
 * picked_team_margin = picked_team_score - opponent_score
 * if picked_team_margin > -spread -> WON
 * if picked_team_margin < -spread -> LOST
 * if picked_team_margin == -spread -> PUSH
 */
function gradeSpreadBet(
  parsedPick: ParsedSpreadPick,
  homeTeam: string,
  homeAbbr: string,
  homeScore: number,
  awayTeam: string,
  awayAbbr: string,
  awayScore: number
): 'won' | 'lost' | 'push' {
  // Determine which team was picked
  const isHomePick = teamsMatch(parsedPick.team, homeTeam, homeAbbr);
  const isAwayPick = teamsMatch(parsedPick.team, awayTeam, awayAbbr);

  if (!isHomePick && !isAwayPick) {
    console.log(`[grade-avatar-picks] Could not match team "${parsedPick.team}" to either ${homeTeam} or ${awayTeam}`);
    throw new Error(`Could not match picked team: ${parsedPick.team}`);
  }

  // Calculate margin from perspective of picked team
  const pickedTeamScore = isHomePick ? homeScore : awayScore;
  const opponentScore = isHomePick ? awayScore : homeScore;
  const margin = pickedTeamScore - opponentScore;

  // The spread is from the picked team's perspective
  // "Bills -3" means Bills need to win by MORE than 3
  // The condition: margin + spread > 0 means WIN
  // margin + spread < 0 means LOSS
  // margin + spread == 0 means PUSH
  const coverMargin = margin + parsedPick.spread;

  console.log(`[grade-avatar-picks] Spread grading: ${parsedPick.team} ${parsedPick.spread}, margin=${margin}, coverMargin=${coverMargin}`);

  if (coverMargin > 0) {
    return 'won';
  } else if (coverMargin < 0) {
    return 'lost';
  } else {
    return 'push';
  }
}

/**
 * Grade a moneyline bet
 */
function gradeMoneylineBet(
  pickedTeam: string,
  homeTeam: string,
  homeAbbr: string,
  homeScore: number,
  awayTeam: string,
  awayAbbr: string,
  awayScore: number
): 'won' | 'lost' | 'push' {
  const isHomePick = teamsMatch(pickedTeam, homeTeam, homeAbbr);
  const isAwayPick = teamsMatch(pickedTeam, awayTeam, awayAbbr);

  if (!isHomePick && !isAwayPick) {
    console.log(`[grade-avatar-picks] Could not match team "${pickedTeam}" to either ${homeTeam} or ${awayTeam}`);
    throw new Error(`Could not match picked team: ${pickedTeam}`);
  }

  const pickedTeamScore = isHomePick ? homeScore : awayScore;
  const opponentScore = isHomePick ? awayScore : homeScore;

  console.log(`[grade-avatar-picks] Moneyline grading: ${pickedTeam}, picked=${pickedTeamScore}, opponent=${opponentScore}`);

  if (pickedTeamScore > opponentScore) {
    return 'won';
  } else if (pickedTeamScore < opponentScore) {
    return 'lost';
  } else {
    // Ties are rare but possible in some sports
    return 'push';
  }
}

/**
 * Grade a total (over/under) bet
 */
function gradeTotalBet(
  parsedPick: ParsedTotalPick,
  homeScore: number,
  awayScore: number
): 'won' | 'lost' | 'push' {
  const actualTotal = homeScore + awayScore;

  console.log(`[grade-avatar-picks] Total grading: ${parsedPick.direction} ${parsedPick.line}, actual=${actualTotal}`);

  if (actualTotal === parsedPick.line) {
    return 'push';
  }

  if (parsedPick.direction === 'over') {
    return actualTotal > parsedPick.line ? 'won' : 'lost';
  } else {
    return actualTotal < parsedPick.line ? 'won' : 'lost';
  }
}

// =============================================================================
// ESPN API Integration
// =============================================================================

/**
 * Fetch final scores from ESPN API for a specific date
 */
async function fetchESPNScores(sport: string, date: string): Promise<Map<string, LiveScore>> {
  const endpoint = ESPN_ENDPOINTS[sport.toLowerCase()];
  if (!endpoint) {
    console.log(`[grade-avatar-picks] No ESPN endpoint for sport: ${sport}`);
    return new Map();
  }

  // Format date for ESPN (YYYYMMDD)
  const espnDate = date.replace(/-/g, '');
  const url = `${endpoint}?dates=${espnDate}`;

  console.log(`[grade-avatar-picks] Fetching ESPN scores from: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[grade-avatar-picks] ESPN API error: ${response.status}`);
      return new Map();
    }

    const data = await response.json();
    const scores = new Map<string, LiveScore>();

    if (data.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        if (event.competitions && event.competitions.length > 0) {
          const competition = event.competitions[0];
          const game: ESPNGame = {
            id: event.id,
            status: competition.status,
            competitors: competition.competitors,
          };

          // Only include final games
          const isFinal = game.status?.type?.completed === true ||
                         game.status?.type?.state === 'post' ||
                         game.status?.type?.name === 'STATUS_FINAL';

          if (!isFinal) {
            continue;
          }

          const homeTeam = game.competitors.find(c => c.homeAway === 'home');
          const awayTeam = game.competitors.find(c => c.homeAway === 'away');

          if (homeTeam && awayTeam) {
            const gameId = `${sport.toUpperCase()}-${game.id}`;
            scores.set(gameId, {
              game_id: gameId,
              league: sport.toUpperCase(),
              away_team: awayTeam.team.displayName,
              away_abbr: awayTeam.team.abbreviation,
              away_score: parseInt(awayTeam.score) || 0,
              home_team: homeTeam.team.displayName,
              home_abbr: homeTeam.team.abbreviation,
              home_score: parseInt(homeTeam.score) || 0,
              status: game.status.type.description || 'Final',
              is_live: false,
            });
          }
        }
      }
    }

    console.log(`[grade-avatar-picks] Found ${scores.size} final ${sport.toUpperCase()} games for ${date}`);
    return scores;
  } catch (error) {
    console.error(`[grade-avatar-picks] Error fetching ESPN scores:`, error);
    return new Map();
  }
}

/**
 * Fetch final scores from live_scores table (backup/cache)
 */
async function fetchLiveScores(
  supabase: SupabaseClient,
  sport: string
): Promise<Map<string, LiveScore>> {
  const { data, error } = await supabase
    .from('live_scores')
    .select('*')
    .eq('league', sport.toUpperCase())
    .eq('is_live', false);

  if (error) {
    console.error(`[grade-avatar-picks] Error fetching live_scores:`, error);
    return new Map();
  }

  const scores = new Map<string, LiveScore>();
  for (const row of data || []) {
    scores.set(row.game_id, row as LiveScore);
  }

  console.log(`[grade-avatar-picks] Found ${scores.size} cached ${sport} scores in live_scores table`);
  return scores;
}

// =============================================================================
// Game ID Matching
// =============================================================================

/**
 * Try to find a matching final score for a pick's game_id
 * The game_id in picks might be different format than ESPN/live_scores
 */
function findMatchingScore(
  pick: AvatarPick,
  espnScores: Map<string, LiveScore>,
  liveScores: Map<string, LiveScore>
): LiveScore | null {
  // Try exact match first
  const espnKey = `${pick.sport.toUpperCase()}-${pick.game_id}`;
  if (espnScores.has(espnKey)) {
    return espnScores.get(espnKey)!;
  }
  if (espnScores.has(pick.game_id)) {
    return espnScores.get(pick.game_id)!;
  }
  if (liveScores.has(espnKey)) {
    return liveScores.get(espnKey)!;
  }
  if (liveScores.has(pick.game_id)) {
    return liveScores.get(pick.game_id)!;
  }

  // Try to match by teams from matchup (format: "Away Team @ Home Team")
  const matchupParts = pick.matchup?.split(' @ ');
  if (matchupParts && matchupParts.length === 2) {
    const awayTeamFromMatchup = matchupParts[0].trim();
    const homeTeamFromMatchup = matchupParts[1].trim();

    // Search ESPN scores
    for (const score of espnScores.values()) {
      if (
        (teamsMatch(awayTeamFromMatchup, score.away_team, score.away_abbr) &&
         teamsMatch(homeTeamFromMatchup, score.home_team, score.home_abbr))
      ) {
        console.log(`[grade-avatar-picks] Matched game by matchup: ${pick.matchup} -> ${score.game_id}`);
        return score;
      }
    }

    // Search live_scores cache
    for (const score of liveScores.values()) {
      if (
        (teamsMatch(awayTeamFromMatchup, score.away_team, score.away_abbr) &&
         teamsMatch(homeTeamFromMatchup, score.home_team, score.home_abbr))
      ) {
        console.log(`[grade-avatar-picks] Matched game by matchup from cache: ${pick.matchup} -> ${score.game_id}`);
        return score;
      }
    }
  }

  // Try matching from archived_game_data
  const archived = pick.archived_game_data;
  if (archived) {
    const archivedMatchup = (archived.matchup as string) || '';
    const archivedParts = archivedMatchup.split(' @ ');
    if (archivedParts.length === 2) {
      const awayTeam = archivedParts[0].trim();
      const homeTeam = archivedParts[1].trim();

      for (const score of espnScores.values()) {
        if (
          teamsMatch(awayTeam, score.away_team, score.away_abbr) &&
          teamsMatch(homeTeam, score.home_team, score.home_abbr)
        ) {
          console.log(`[grade-avatar-picks] Matched game by archived matchup: ${archivedMatchup} -> ${score.game_id}`);
          return score;
        }
      }
    }
  }

  console.log(`[grade-avatar-picks] Could not find score for game: ${pick.game_id} (${pick.matchup})`);
  return null;
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[grade-avatar-picks] Starting pick grading...');

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = getTodayInET();

    console.log(`[grade-avatar-picks] Today (ET): ${today}`);

    // -------------------------------------------------------------------------
    // 1. Fetch pending picks where game_date <= today
    // -------------------------------------------------------------------------
    const { data: pendingPicks, error: fetchError } = await supabase
      .from('avatar_picks')
      .select('*')
      .eq('result', 'pending')
      .lte('game_date', today);

    if (fetchError) {
      throw new Error(`Failed to fetch pending picks: ${fetchError.message}`);
    }

    if (!pendingPicks || pendingPicks.length === 0) {
      console.log('[grade-avatar-picks] No pending picks to grade');
      return new Response(
        JSON.stringify({
          success: true,
          summary: {
            total_processed: 0,
            won: 0,
            lost: 0,
            push: 0,
            skipped: 0,
            errors: 0,
          },
          avatars_updated: [],
          details: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[grade-avatar-picks] Found ${pendingPicks.length} pending picks to process`);

    // -------------------------------------------------------------------------
    // 2. Group picks by sport and date
    // -------------------------------------------------------------------------
    const picksBySportDate = new Map<string, AvatarPick[]>();
    for (const pick of pendingPicks) {
      const key = `${pick.sport}-${pick.game_date}`;
      if (!picksBySportDate.has(key)) {
        picksBySportDate.set(key, []);
      }
      picksBySportDate.get(key)!.push(pick as AvatarPick);
    }

    console.log(`[grade-avatar-picks] Grouped into ${picksBySportDate.size} sport/date combinations`);

    // -------------------------------------------------------------------------
    // 3. Fetch final scores for each sport/date
    // -------------------------------------------------------------------------
    const allScores = new Map<string, Map<string, LiveScore>>();

    for (const key of picksBySportDate.keys()) {
      const [sport, date] = key.split('-').slice(0, 1).concat(key.split('-').slice(1).join('-'));
      const scoreKey = key;

      if (!allScores.has(scoreKey)) {
        // Fetch from ESPN API
        const espnScores = await fetchESPNScores(sport, date);
        // Also fetch from live_scores cache as backup
        const liveScoresCache = await fetchLiveScores(supabase, sport);

        // Merge both sources
        const merged = new Map<string, LiveScore>();
        for (const [id, score] of liveScoresCache) {
          merged.set(id, score);
        }
        for (const [id, score] of espnScores) {
          merged.set(id, score); // ESPN takes precedence
        }

        allScores.set(scoreKey, merged);
      }
    }

    // -------------------------------------------------------------------------
    // 4. Grade each pick
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
        const scoreKey = `${pick.sport}-${pick.game_date}`;
        const scores = allScores.get(scoreKey) || new Map();
        const espnScores = await fetchESPNScores(pick.sport, pick.game_date);

        // Find matching final score
        const finalScore = findMatchingScore(pick, espnScores, scores);

        if (!finalScore) {
          console.log(`[grade-avatar-picks] Skipping pick ${pick.id} - no final score found for ${pick.matchup}`);
          summary.skipped++;
          continue;
        }

        // Grade based on bet type
        let result: 'won' | 'lost' | 'push';
        const actualResult = `${finalScore.away_team} ${finalScore.away_score}, ${finalScore.home_team} ${finalScore.home_score}`;

        switch (pick.bet_type) {
          case 'spread': {
            const parsed = parseSpreadPick(pick.pick_selection);
            if (!parsed) {
              console.error(`[grade-avatar-picks] Failed to parse spread pick: ${pick.pick_selection}`);
              summary.errors++;
              continue;
            }
            result = gradeSpreadBet(
              parsed,
              finalScore.home_team,
              finalScore.home_abbr,
              finalScore.home_score,
              finalScore.away_team,
              finalScore.away_abbr,
              finalScore.away_score
            );
            break;
          }

          case 'moneyline': {
            const pickedTeam = parseMoneylinePick(pick.pick_selection);
            if (!pickedTeam) {
              console.error(`[grade-avatar-picks] Failed to parse moneyline pick: ${pick.pick_selection}`);
              summary.errors++;
              continue;
            }
            result = gradeMoneylineBet(
              pickedTeam,
              finalScore.home_team,
              finalScore.home_abbr,
              finalScore.home_score,
              finalScore.away_team,
              finalScore.away_abbr,
              finalScore.away_score
            );
            break;
          }

          case 'total': {
            const parsed = parseTotalPick(pick.pick_selection);
            if (!parsed) {
              console.error(`[grade-avatar-picks] Failed to parse total pick: ${pick.pick_selection}`);
              summary.errors++;
              continue;
            }
            result = gradeTotalBet(
              parsed,
              finalScore.home_score,
              finalScore.away_score
            );
            break;
          }

          default:
            console.error(`[grade-avatar-picks] Unknown bet type: ${pick.bet_type}`);
            summary.errors++;
            continue;
        }

        // Update the pick in database
        const { error: updateError } = await supabase
          .from('avatar_picks')
          .update({
            result,
            actual_result: actualResult,
            graded_at: new Date().toISOString(),
          })
          .eq('id', pick.id);

        if (updateError) {
          console.error(`[grade-avatar-picks] Failed to update pick ${pick.id}:`, updateError);
          summary.errors++;
          continue;
        }

        // Track result
        summary[result]++;
        affectedAvatars.add(pick.avatar_id);
        gradedDetails.push({
          pick_id: pick.id,
          result,
          actual_result: actualResult,
        });

        console.log(`[grade-avatar-picks] Graded pick ${pick.id}: ${result} (${actualResult})`);

      } catch (error) {
        console.error(`[grade-avatar-picks] Error grading pick ${pick.id}:`, error);
        summary.errors++;
      }
    }

    // -------------------------------------------------------------------------
    // 5. Recalculate performance for affected avatars
    // -------------------------------------------------------------------------
    const avatarsUpdated: string[] = [];

    for (const avatarId of affectedAvatars) {
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
    // 6. Return summary
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
