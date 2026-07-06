import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import { getNCAABTeamColors, getNCAABTeamInitials } from '@/utils/teamColors';
import type { GameFeedItem, SportFeed, TeamRef } from '../types';

/**
 * NCAAB adapter — port of the legacy src/pages/NCAAB.tsx fetchData() merge:
 * v_cbb_input_values (all games) + ncaab_predictions (latest run by
 * as_of_ts_utc) + ncaab_team_mapping (api_team_id → ESPN logo/abbrev),
 * merged on game_id.
 */

export interface NCAABPrediction {
  id: string;
  away_team: string;
  home_team: string;
  away_team_id?: number | null;
  home_team_id?: number | null;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
  game_date: string;
  game_time: string;
  training_key: string;
  unique_id: string;
  // Model predictions
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
  // Edge values (delta) - like College Football
  home_spread_diff?: number | null;
  over_line_diff?: number | null;
  // Score predictions for match simulator
  home_score_pred?: number | null;
  away_score_pred?: number | null;
  // NCAAB-specific fields
  home_ranking: number | null;
  away_ranking: number | null;
  conference_game: boolean | null;
  neutral_site: boolean | null;
  // Public betting splits (may not exist for basketball)
  spread_splits_label: string | null;
  total_splits_label: string | null;
  ml_splits_label: string | null;
  [key: string]: unknown;
}

/**
 * Quirk kept from the page: `espn_team_url` here is NOT the ESPN team page URL
 * from the table — it's the logo URL constructed from espn_team_id (or
 * '/placeholder.svg'). Detail sections rely on this field name.
 */
export interface NCAABTeamMappingEntry {
  espn_team_url: string;
  team_abbrev: string | null;
}

/** Port of NCAAB.tsx getTeamInitials: mapping abbrev by team id, else name-based fallback. */
export const getNcaabInitials = (
  teamName: string,
  teamId: number | null | undefined,
  mappingsById: Map<number, NCAABTeamMappingEntry>
): string => {
  if (teamId !== null && teamId !== undefined) {
    const numericTeamId = typeof teamId === 'string' ? parseInt(teamId, 10) : teamId;
    const mapping = mappingsById.get(numericTeamId);
    if (mapping?.team_abbrev && mapping.team_abbrev.trim() !== '') {
      return mapping.team_abbrev;
    }
  }
  return getNCAABTeamInitials(teamName);
};

/** Port of NCAAB.tsx getTeamLogo: id lookup only, placeholder when missing. */
export const getNcaabLogo = (
  teamId: number | null | undefined,
  mappingsById: Map<number, NCAABTeamMappingEntry>
): string => {
  if (teamId !== null && teamId !== undefined) {
    const numericTeamId = typeof teamId === 'string' ? parseInt(teamId, 10) : teamId;
    const mapping = mappingsById.get(numericTeamId);
    if (
      mapping?.espn_team_url &&
      mapping.espn_team_url !== '/placeholder.svg' &&
      mapping.espn_team_url.trim() !== ''
    ) {
      return mapping.espn_team_url;
    }
  }
  return '/placeholder.svg';
};

// Port of NCAAB.tsx convertTimeToEST — start_utc is a real UTC timestamp
// (unlike NFL's +5h quirk), so this is a straight tz conversion. Ported
// verbatim, including the bare-time-string branch that assumes "today" UTC.
export function convertNcaabTimeToEST(timeString: string | null | undefined): string {
  if (!timeString || timeString.trim() === '') {
    return 'TBD';
  }

  try {
    let date: Date;

    // ISO datetime (e.g. "2025-11-14T00:30:00Z" or "2025-11-14 00:30:00+00")
    if (timeString.includes('T') || (timeString.includes(' ') && timeString.length > 10)) {
      date = new Date(timeString);
      if (isNaN(date.getTime())) {
        debug.error('Invalid ISO datetime:', timeString);
        return 'TBD';
      }
    } else {
      // Simple time string (e.g. "15:30:00" or "15:30"), treated as UTC today
      const parts = timeString.split(':');
      if (parts.length < 2) {
        debug.error('Invalid time format:', timeString);
        return 'TBD';
      }

      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);

      if (isNaN(hours) || isNaN(minutes)) {
        debug.error('Invalid time values:', timeString);
        return 'TBD';
      }

      const today = new Date();
      date = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hours, minutes, 0)
      );
    }

    const timeStr = date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date);
    const tzName = parts.find((part) => part.type === 'timeZoneName')?.value || 'EST';

    return `${timeStr} ${tzName}`;
  } catch (error) {
    debug.error('Error formatting time:', error, timeString);
    return 'TBD';
  }
}

export async function fetchNcaabGames(): Promise<SportFeed<NCAABPrediction>> {
  // Step 1: ALL games from v_cbb_input_values
  const { data: ncaabGames, error: gamesError } = await collegeFootballSupabase
    .from('v_cbb_input_values')
    .select('*')
    .order('game_date_et', { ascending: true })
    .order('tipoff_time_et', { ascending: true });

  if (gamesError) {
    throw new Error(`Games error: ${gamesError.message}`);
  }

  // Step 2: predictions from latest run (by as_of_ts_utc), scoped to fetched game_ids
  const { data: latestRun, error: runError } = await collegeFootballSupabase
    .from('ncaab_predictions')
    .select('run_id, as_of_ts_utc')
    .order('as_of_ts_utc', { ascending: false })
    .limit(1)
    .maybeSingle();

  const predictionsMap = new Map<string | number, any>();
  if (!runError && latestRun) {
    const gameIds = (ncaabGames || []).map((g: any) => g.game_id);
    const { data: predictions, error: predsError } = await collegeFootballSupabase
      .from('ncaab_predictions')
      .select(
        'game_id, home_win_prob, away_win_prob, pred_home_margin, pred_total_points, run_id, vegas_home_spread, vegas_total, vegas_home_moneyline, vegas_away_moneyline, home_score_pred, away_score_pred, model_fair_home_spread, home_team_id, away_team_id'
      )
      .eq('run_id', latestRun.run_id)
      .in('game_id', gameIds);

    if (!predsError && predictions) {
      predictions.forEach((pred) => predictionsMap.set(pred.game_id, pred));
    } else {
      debug.warn('No NCAAB predictions found or error:', predsError);
    }
  } else {
    debug.warn('No NCAAB prediction run_id found');
  }

  // Step 3: team mappings — api_team_id matches home_team_id/away_team_id in
  // v_cbb_input_values; logo built from espn_team_id (ESPN NCAA CDN pattern).
  const { data: teamMappingsData, error: teamMappingsError } = await collegeFootballSupabase
    .from('ncaab_team_mapping')
    .select('api_team_id, espn_team_id, espn_team_url, team_abbrev');

  const teamMappingsById = new Map<number, NCAABTeamMappingEntry>();
  if (teamMappingsError) {
    debug.error('Error fetching NCAAB team mappings:', teamMappingsError);
  } else {
    (teamMappingsData || []).forEach((team: any) => {
      if (team.api_team_id !== null && team.api_team_id !== undefined) {
        const numericId =
          typeof team.api_team_id === 'string' ? parseInt(team.api_team_id, 10) : team.api_team_id;

        let logoUrl = '/placeholder.svg';
        if (team.espn_team_id !== null && team.espn_team_id !== undefined) {
          const espnTeamId =
            typeof team.espn_team_id === 'string'
              ? parseInt(team.espn_team_id, 10)
              : team.espn_team_id;
          logoUrl = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnTeamId}.png`;
        }

        teamMappingsById.set(numericId, {
          espn_team_url: logoUrl,
          team_abbrev: team.team_abbrev || null,
        });
      }
    });
  }

  // Step 4: merge games with predictions (game_id = game_id)
  const merged: NCAABPrediction[] = (ncaabGames || []).map((game: any) => {
    const prediction = predictionsMap.get(game.game_id);
    const gameIdStr = String(game.game_id);

    const vegasHomeSpread = prediction?.vegas_home_spread || game.spread || null;
    const modelFairHomeSpread = prediction?.model_fair_home_spread || null;
    const homeSpreadDiff =
      vegasHomeSpread !== null && modelFairHomeSpread !== null
        ? vegasHomeSpread - modelFairHomeSpread
        : null;

    const vegasTotal = prediction?.vegas_total || game.over_under || null;
    const predTotalPoints = prediction?.pred_total_points || null;
    const overLineDiff =
      vegasTotal !== null && predTotalPoints !== null ? predTotalPoints - vegasTotal : null;

    // Moneylines: v_cbb_input_values uses camelCase columns; predictions snake_case fallback
    const homeML = game.homeMoneyline ?? prediction?.vegas_home_moneyline ?? null;
    const awayML = game.awayMoneyline ?? prediction?.vegas_away_moneyline ?? null;

    const homeTeamId = game.home_team_id || null;
    const awayTeamId = game.away_team_id || null;

    return {
      id: gameIdStr,
      away_team: game.away_team,
      home_team: game.home_team,
      away_team_id: awayTeamId,
      home_team_id: homeTeamId,
      training_key: gameIdStr,
      unique_id: gameIdStr,
      home_ml: homeML,
      away_ml: awayML,
      home_spread: vegasHomeSpread,
      away_spread: vegasHomeSpread !== null ? -vegasHomeSpread : null,
      over_line: vegasTotal,
      game_date: game.game_date_et || '',
      game_time: game.start_utc || game.tipoff_time_et || '',
      home_away_ml_prob: prediction?.home_win_prob || null,
      // Quirk kept from the page: home_win_prob doubles as the spread-cover
      // proxy, and O/U prob is a synthetic 0.6/0.4 from the total comparison.
      home_away_spread_cover_prob: prediction?.home_win_prob || null,
      ou_result_prob:
        prediction && prediction.pred_total_points && prediction.vegas_total
          ? prediction.pred_total_points > prediction.vegas_total
            ? 0.6
            : 0.4
          : null,
      run_id: prediction?.run_id || null,
      home_spread_diff: homeSpreadDiff,
      over_line_diff: overLineDiff,
      // Model predicted lines (for modal display)
      pred_spread:
        modelFairHomeSpread !== null ? modelFairHomeSpread : prediction?.pred_home_margin || null,
      pred_over_line: predTotalPoints,
      // Vegas lines for reference
      api_spread: vegasHomeSpread,
      api_over_line: vegasTotal,
      home_score_pred: prediction?.home_score_pred || null,
      away_score_pred: prediction?.away_score_pred || null,
      home_ranking: game.home_ranking || null,
      away_ranking: game.away_ranking || null,
      conference_game: game.conference_game || null,
      neutral_site: game.neutral_site || null,
      // Public betting splits not available for basketball
      spread_splits_label: null,
      ml_splits_label: null,
      total_splits_label: null,
    };
  });

  const teamRef = (teamName: string, teamId: number | null | undefined): TeamRef => ({
    name: teamName,
    abbrev: getNcaabInitials(teamName, teamId, teamMappingsById),
    logoUrl: getNcaabLogo(teamId, teamMappingsById),
    colors: getNCAABTeamColors(teamName),
  });

  const games: GameFeedItem<NCAABPrediction>[] = merged.map((row) => ({
    sport: 'ncaab',
    id: row.id,
    awayTeam: teamRef(row.away_team, row.away_team_id),
    homeTeam: teamRef(row.home_team, row.home_team_id),
    gameDate: row.game_date || '',
    gameTimeLabel: convertNcaabTimeToEST(row.game_time),
    // Raw start_utc/tipoff string — the page sorts by localeCompare on it
    timeSortKey: row.game_time || '',
    status: 'scheduled',
    lines: {
      homeML: row.home_ml,
      awayML: row.away_ml,
      homeSpread: row.home_spread,
      awaySpread: row.away_spread,
      total: row.over_line,
    },
    edges: {
      spreadEdge: row.home_spread_diff ?? null,
      totalEdge: row.over_line_diff ?? null,
      mlProb: row.home_away_ml_prob,
    },
    raw: row,
  }));

  // Plain object instead of Map — Maps don't survive React Query cache
  // serialization; detail sections re-key by String(team_id).
  const teamMappingsByIdRecord: Record<string, NCAABTeamMappingEntry> = {};
  teamMappingsById.forEach((value, key) => {
    teamMappingsByIdRecord[String(key)] = value;
  });

  return {
    games,
    extras: { teamMappingsById: teamMappingsByIdRecord },
    fetchedAt: Date.now(),
  };
}
