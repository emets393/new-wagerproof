import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { format } from 'https://esm.sh/date-fns@3.6.0';
import { toZonedTime } from 'https://esm.sh/date-fns-tz@3.0.0';

interface AvatarPick {
  id: string;
  avatar_id: string;
  game_id: string;
  sport: string;
  matchup: string;
  game_date: string;
  bet_type: 'spread' | 'moneyline' | 'total';
  pick_selection: string;
  archived_game_data: Record<string, unknown>;
  result: 'won' | 'lost' | 'push' | 'pending';
  actual_result: string | null;
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

interface RegradeSummary {
  total_push_picks: number;
  evaluated: number;
  regraded_total: number;
  regraded_to_won: number;
  regraded_to_lost: number;
  remained_push: number;
  skipped: number;
  skipped_reasons: Record<string, number>;
  errors: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getTodayInET(): string {
  const now = new Date();
  const easternTime = toZonedTime(now, 'America/New_York');
  return format(easternTime, 'yyyy-MM-dd');
}

function incrementReason(counter: Record<string, number>, reason: string): void {
  counter[reason] = (counter[reason] || 0) + 1;
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
    if (parts.length === 2) return { away: parts[0].trim(), home: parts[1].trim() };
  }
  return null;
}

function getArchivedTeamNames(archivedGameData: Record<string, unknown> | null | undefined): { away: string | null; home: string | null } {
  const obj = archivedGameData || {};
  const gameDataComplete = (obj.game_data_complete as Record<string, unknown> | undefined) || {};
  const rawGameData = (gameDataComplete.raw_game_data as Record<string, unknown> | undefined) || {};
  const awayCandidates = [obj.away_team, gameDataComplete.away_team, rawGameData.away_team];
  const homeCandidates = [obj.home_team, gameDataComplete.home_team, rawGameData.home_team];
  const away = awayCandidates.find(v => typeof v === 'string' && v.trim()) as string | undefined;
  const home = homeCandidates.find(v => typeof v === 'string' && v.trim()) as string | undefined;
  return { away: away ?? null, home: home ?? null };
}

function isLikelyPushLine(value: number): boolean {
  return Number.isInteger(value);
}

function parseSpreadPick(selection: string): ParsedSpreadPick | null {
  const match = selection.match(/^(.+?)\s*([+-]?\d+\.?\d*)$/);
  if (!match) return null;
  return {
    team: match[1].trim(),
    spread: parseFloat(match[2]),
  };
}

function parseTotalPick(selection: string): ParsedTotalPick | null {
  const match = selection.match(/^(over|under)\s+(\d+\.?\d*)$/i);
  if (!match) return null;
  return {
    direction: match[1].toLowerCase() as 'over' | 'under',
    line: parseFloat(match[2]),
  };
}

function parseMoneylinePick(selection: string): string | null {
  let cleaned = selection.replace(/\s*ML$/i, '').trim();
  cleaned = cleaned.replace(/\s*[+-]\d+$/, '').trim();
  if (!cleaned) return null;
  return cleaned;
}

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
    console.error(`[regrade-avatar-pushes] Error fetching game results for ${league}:`, error);
    return results;
  }

  for (const row of data || []) {
    results.set(row.game_id, row as GameResult);
  }
  return results;
}

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
  if (picked === home) return gameResult.home_team;
  if (picked === away) return gameResult.away_team;

  const homeContains = home.includes(picked) || picked.includes(home);
  const awayContains = away.includes(picked) || picked.includes(away);
  if (homeContains && !awayContains) return gameResult.home_team;
  if (awayContains && !homeContains) return gameResult.away_team;

  const parsed = parseMatchup(matchup);
  if (parsed) {
    const matchupAway = normalizeTeamName(parsed.away);
    const matchupHome = normalizeTeamName(parsed.home);
    const homeSideMatch = matchupHome.includes(picked) || picked.includes(matchupHome);
    const awaySideMatch = matchupAway.includes(picked) || picked.includes(matchupAway);
    if (homeSideMatch && !awaySideMatch) return gameResult.home_team;
    if (awaySideMatch && !homeSideMatch) return gameResult.away_team;
  }

  const archivedTeams = getArchivedTeamNames(archivedGameData);
  const archivedAway = normalizeTeamName(archivedTeams.away);
  const archivedHome = normalizeTeamName(archivedTeams.home);
  const archivedHomeMatch = archivedHome && (archivedHome.includes(picked) || picked.includes(archivedHome));
  const archivedAwayMatch = archivedAway && (archivedAway.includes(picked) || picked.includes(archivedAway));
  if (archivedHomeMatch && !archivedAwayMatch) return gameResult.home_team;
  if (archivedAwayMatch && !archivedHomeMatch) return gameResult.away_team;

  return null;
}

function findGameResult(
  pick: AvatarPick,
  resultsMap: Map<string, GameResult>,
  allResults: GameResult[]
): GameResult | null {
  if (resultsMap.has(pick.game_id)) return resultsMap.get(pick.game_id)!;

  const pickDate = toDateOnly(pick.game_date);
  const parsedMatchup = parseMatchup(pick.matchup);
  const archivedTeams = getArchivedTeamNames(pick.archived_game_data);
  const rawAway = normalizeTeamName(parsedMatchup?.away ?? archivedTeams.away);
  const rawHome = normalizeTeamName(parsedMatchup?.home ?? archivedTeams.home);
  if (!pickDate || !rawAway || !rawHome) return null;

  for (const result of allResults) {
    const resultDate = toDateOnly(result.game_date);
    if (!resultDate || resultDate !== pickDate) continue;
    const resultAway = normalizeTeamName(result.away_team);
    const resultHome = normalizeTeamName(result.home_team);
    const homeMatch = resultHome.includes(rawHome) || rawHome.includes(resultHome);
    const awayMatch = resultAway.includes(rawAway) || rawAway.includes(resultAway);
    if (homeMatch && awayMatch) return result;
  }
  return null;
}

function regradePick(
  pick: AvatarPick,
  gameResult: GameResult
): { result: 'won' | 'lost' | 'push'; actual_result: string } | { skip_reason: string } {
  const actualResultPrefix = `${gameResult.away_team} vs ${gameResult.home_team}`;

  switch (pick.bet_type) {
    case 'moneyline': {
      if (!gameResult.ml_result) return { skip_reason: 'game_not_final_ml' };
      const pickedTeam = parseMoneylinePick(pick.pick_selection);
      if (!pickedTeam) return { skip_reason: 'parse_error_moneyline' };
      const canonical = resolveCanonicalTeamName(pickedTeam, gameResult, pick.matchup, pick.archived_game_data);
      if (!canonical) return { skip_reason: 'unresolved_team_moneyline' };
      return {
        result: canonical === gameResult.ml_result ? 'won' : 'lost',
        actual_result: `${actualResultPrefix} — ML winner: ${gameResult.ml_result}`,
      };
    }
    case 'spread': {
      if (!gameResult.spread_result) return { skip_reason: 'game_not_final_spread' };
      const parsed = parseSpreadPick(pick.pick_selection);
      if (!parsed) return { skip_reason: 'parse_error_spread' };
      const canonical = resolveCanonicalTeamName(parsed.team, gameResult, pick.matchup, pick.archived_game_data);
      if (!canonical) return { skip_reason: 'unresolved_team_spread' };
      if (gameResult.spread_result.toUpperCase() === 'PUSH') {
        if (!isLikelyPushLine(parsed.spread)) return { skip_reason: 'impossible_spread_push_hook_line' };
        return {
          result: 'push',
          actual_result: `${actualResultPrefix} — Spread: ${gameResult.spread_result}`,
        };
      }
      return {
        result: canonical === gameResult.spread_result ? 'won' : 'lost',
        actual_result: `${actualResultPrefix} — Spread: ${gameResult.spread_result}`,
      };
    }
    case 'total': {
      if (!gameResult.ou_result) return { skip_reason: 'game_not_final_total' };
      const parsed = parseTotalPick(pick.pick_selection);
      if (!parsed) return { skip_reason: 'parse_error_total' };
      const ouResult = gameResult.ou_result.toLowerCase();
      if (ouResult === 'push') {
        if (!isLikelyPushLine(parsed.line)) return { skip_reason: 'impossible_total_push_hook_line' };
        return {
          result: 'push',
          actual_result: `${actualResultPrefix} — Total: ${gameResult.ou_result}`,
        };
      }
      return {
        result: ouResult === parsed.direction ? 'won' : 'lost',
        actual_result: `${actualResultPrefix} — Total: ${gameResult.ou_result}`,
      };
    }
    default:
      return { skip_reason: 'unknown_bet_type' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const startedAt = Date.now();
  let dryRun = false;
  let sports: string[] = ['nba', 'ncaab'];
  try {
    const body = await req.json();
    dryRun = Boolean((body as Record<string, unknown> | null)?.dry_run);
    const maybeSports = (body as Record<string, unknown> | null)?.sports;
    if (Array.isArray(maybeSports) && maybeSports.length > 0) {
      sports = maybeSports.map(v => String(v).toLowerCase().trim()).filter(Boolean);
    }
  } catch {
    // allow empty body
  }

  const summary: RegradeSummary = {
    total_push_picks: 0,
    evaluated: 0,
    regraded_total: 0,
    regraded_to_won: 0,
    regraded_to_lost: 0,
    remained_push: 0,
    skipped: 0,
    skipped_reasons: {},
    errors: 0,
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const cfbSupabaseUrl = Deno.env.get('CFB_SUPABASE_URL') ?? '';
    const cfbSupabaseKey = Deno.env.get('CFB_SUPABASE_ANON_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing main Supabase config');
    if (!cfbSupabaseUrl || !cfbSupabaseKey) throw new Error('Missing CFB Supabase config');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const cfbClient = createClient(cfbSupabaseUrl, cfbSupabaseKey);

    const today = getTodayInET();
    const { data: pushPicks, error: fetchError } = await supabase
      .from('avatar_picks')
      .select('*')
      .eq('result', 'push')
      .lte('game_date', today)
      .in('sport', sports);

    if (fetchError) throw new Error(`Failed fetching push picks: ${fetchError.message}`);
    const picks = (pushPicks || []) as AvatarPick[];
    summary.total_push_picks = picks.length;
    if (picks.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: dryRun,
        sports,
        summary,
        changed: [],
        duration_ms: Date.now() - startedAt,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const nbaDates = new Set<string>();
    const ncaabDates = new Set<string>();
    for (const pick of picks) {
      if (pick.sport === 'nba') nbaDates.add(toDateOnly(pick.game_date) || pick.game_date);
      if (pick.sport === 'ncaab') ncaabDates.add(toDateOnly(pick.game_date) || pick.game_date);
    }

    const [nbaResults, ncaabResults] = await Promise.all([
      nbaDates.size > 0 ? fetchGameResults(cfbClient, 'NBA', [...nbaDates]) : Promise.resolve(new Map<string, GameResult>()),
      ncaabDates.size > 0 ? fetchGameResults(cfbClient, 'NCAAB', [...ncaabDates]) : Promise.resolve(new Map<string, GameResult>()),
    ]);

    const resultsByLeague: Record<string, { map: Map<string, GameResult>; all: GameResult[] }> = {
      nba: { map: nbaResults, all: [...nbaResults.values()] },
      ncaab: { map: ncaabResults, all: [...ncaabResults.values()] },
    };

    const changed: Array<Record<string, unknown>> = [];
    const affectedAvatars = new Set<string>();

    for (const pick of picks) {
      summary.evaluated++;
      try {
        const leagueData = resultsByLeague[pick.sport];
        if (!leagueData) {
          summary.skipped++;
          incrementReason(summary.skipped_reasons, 'unsupported_sport');
          continue;
        }

        const gameResult = findGameResult(pick, leagueData.map, leagueData.all);
        if (!gameResult) {
          summary.skipped++;
          incrementReason(summary.skipped_reasons, 'game_not_found');
          continue;
        }

        const grading = regradePick(pick, gameResult);
        if ('skip_reason' in grading) {
          summary.skipped++;
          incrementReason(summary.skipped_reasons, grading.skip_reason);
          continue;
        }

        if (grading.result === 'push') {
          summary.remained_push++;
          continue;
        }

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
            summary.errors++;
            incrementReason(summary.skipped_reasons, 'update_error');
            continue;
          }
        }

        summary.regraded_total++;
        if (grading.result === 'won') summary.regraded_to_won++;
        if (grading.result === 'lost') summary.regraded_to_lost++;
        affectedAvatars.add(pick.avatar_id);
        if (changed.length < 500) {
          changed.push({
            pick_id: pick.id,
            avatar_id: pick.avatar_id,
            sport: pick.sport,
            game_date: pick.game_date,
            matchup: pick.matchup,
            pick_selection: pick.pick_selection,
            from_result: pick.result,
            to_result: grading.result,
            new_actual_result: grading.actual_result,
          });
        }
      } catch (error) {
        summary.errors++;
        incrementReason(summary.skipped_reasons, 'processing_error');
        console.error('[regrade-avatar-pushes] pick processing error:', pick.id, error);
      }
    }

    const avatarsUpdated: string[] = [];
    for (const avatarId of affectedAvatars) {
      if (dryRun) {
        avatarsUpdated.push(avatarId);
        continue;
      }
      const { error: recalcError } = await supabase.rpc('recalculate_avatar_performance', { p_avatar_id: avatarId });
      if (!recalcError) avatarsUpdated.push(avatarId);
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      sports,
      summary,
      avatars_updated: avatarsUpdated,
      changed,
      changed_count_total: summary.regraded_total,
      report_generated_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[regrade-avatar-pushes] fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message || 'Unknown error',
      summary,
      duration_ms: Date.now() - startedAt,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
