import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import { getNBATeamColors, getNBATeamInitials } from '@/utils/teamColors';
import type { GameFeedItem, SportFeed, TeamRef } from '../types';

/**
 * NBA adapter — port of the legacy src/pages/NBA.tsx fetchData() merge:
 * nba_input_values_view (all games, phantom-game filter) + nba_predictions
 * (latest run by as_of_ts_utc, joined on game_id) + nba_teams_master logos.
 */

export interface NBAPrediction {
  id: string;
  away_team: string;
  home_team: string;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  over_line: number | null;
  game_date: string;
  game_time: string;
  training_key: string;
  unique_id: string;
  game_id?: number;
  home_team_id?: number | null;
  away_team_id?: number | null;
  // Model predictions
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
  // Edge values (delta) - like College Basketball
  home_spread_diff?: number | null;
  over_line_diff?: number | null;
  // Public betting splits (may not exist for basketball)
  spread_splits_label: string | null;
  total_splits_label: string | null;
  ml_splits_label: string | null;
  [key: string]: unknown;
}

export interface NBATeamMapping {
  team_id: number;
  team_name: string;
  abbreviation: string;
  logo_url: string;
}

// ESPN fallback logos (port of NBA.tsx getTeamLogo) — used when
// nba_teams_master has no usable logo_url for a team.
const ESPN_LOGO_MAP: Record<string, string> = {
  'Atlanta Hawks': 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png',
  'Boston Celtics': 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
  'Brooklyn Nets': 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
  'Charlotte Hornets': 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png',
  'Chicago Bulls': 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png',
  'Cleveland Cavaliers': 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png',
  'Dallas Mavericks': 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png',
  'Denver Nuggets': 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
  'Detroit Pistons': 'https://a.espncdn.com/i/teamlogos/nba/500/det.png',
  'Golden State Warriors': 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
  'Houston Rockets': 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png',
  'Indiana Pacers': 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png',
  'LA Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
  'Los Angeles Clippers': 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png',
  'Los Angeles Lakers': 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
  'Memphis Grizzlies': 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png',
  'Miami Heat': 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
  'Milwaukee Bucks': 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
  'Minnesota Timberwolves': 'https://a.espncdn.com/i/teamlogos/nba/500/min.png',
  'New Orleans Pelicans': 'https://a.espncdn.com/i/teamlogos/nba/500/no.png',
  'New York Knicks': 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png',
  'Oklahoma City Thunder': 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png',
  'Orlando Magic': 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png',
  'Philadelphia 76ers': 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png',
  'Phoenix Suns': 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png',
  'Portland Trail Blazers': 'https://a.espncdn.com/i/teamlogos/nba/500/por.png',
  'Sacramento Kings': 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png',
  'San Antonio Spurs': 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png',
  'Toronto Raptors': 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png',
  'Utah Jazz': 'https://a.espncdn.com/i/teamlogos/nba/500/utah.png',
  'Washington Wizards': 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png',
};

/** Port of NBA.tsx getTeamLogo: db mapping first (fuzzy), then ESPN fallbacks. */
export const getNBATeamLogo = (teamName: string, teamMappings: NBATeamMapping[]): string => {
  if (!teamName) return '/placeholder.svg';

  const mapping = teamMappings.find((m) => {
    if (!m?.team_name) return false;
    return (
      m.team_name === teamName ||
      teamName.includes(m.team_name) ||
      m.team_name.includes(teamName)
    );
  });

  if (mapping?.logo_url && mapping.logo_url !== '/placeholder.svg' && mapping.logo_url.trim() !== '') {
    return mapping.logo_url;
  }

  if (ESPN_LOGO_MAP[teamName]) {
    return ESPN_LOGO_MAP[teamName];
  }

  const lowerTeamName = teamName.toLowerCase();
  const matchedKey = Object.keys(ESPN_LOGO_MAP).find((key) => key.toLowerCase() === lowerTeamName);
  if (matchedKey) {
    return ESPN_LOGO_MAP[matchedKey];
  }

  for (const [key, url] of Object.entries(ESPN_LOGO_MAP)) {
    if (
      teamName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(teamName.toLowerCase())
    ) {
      return url;
    }
  }

  debug.log(`⚠️ No logo found for team: ${teamName}`);
  return '/placeholder.svg';
};

/** Port of NBA.tsx getTeamInitials: db abbreviation first, static map fallback. */
const getTeamAbbrev = (teamName: string, teamMappings: NBATeamMapping[]): string => {
  const mapping = teamMappings.find((m) => m.team_name === teamName);
  if (mapping?.abbreviation) return mapping.abbreviation;
  return getNBATeamInitials(teamName);
};

const teamRef = (teamName: string, teamMappings: NBATeamMapping[]): TeamRef => ({
  name: teamName,
  abbrev: getTeamAbbrev(teamName, teamMappings),
  logoUrl: getNBATeamLogo(teamName, teamMappings),
  colors: getNBATeamColors(teamName),
});

// Port of NBA.tsx convertTimeToEST. tipoff_time_et arrives either as an ISO
// datetime or a bare HH:MM[:SS] string treated as UTC-on-today — ported
// verbatim (quirks included) so displayed tipoff times match the legacy page.
function convertTimeToEST(timeString: string | null | undefined): string {
  if (!timeString || timeString.trim() === '') {
    return 'TBD';
  }

  try {
    let date: Date;

    if (timeString.includes('T') || (timeString.includes(' ') && timeString.length > 10)) {
      date = new Date(timeString);
      if (isNaN(date.getTime())) {
        debug.error('Invalid ISO datetime:', timeString);
        return 'TBD';
      }
    } else {
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

export async function fetchNbaGames(): Promise<SportFeed<NBAPrediction>> {
  // Step 1: all games from nba_input_values_view
  const { data: rawNbaGames, error: gamesError } = await collegeFootballSupabase
    .from('nba_input_values_view')
    .select(
      'game_id, game_date, home_team, away_team, home_team_id, away_team_id, home_moneyline, home_spread, total_line, tipoff_time_et, season, game_type, home_abbr, away_abbr, *'
    )
    .order('game_date', { ascending: true })
    .order('tipoff_time_et', { ascending: true });

  if (gamesError) {
    throw new Error(`Games error: ${gamesError.message}`);
  }

  // Drop "phantom" postseason games — series-decided "if necessary" games
  // (e.g. Game 5 of a 4-1 series) stay in nba_team_boxscores until manually
  // removed, but the books never post lines for them. If NO line is up
  // (ML, spread, AND total all null), treat the game as not happening.
  const nbaGames = (rawNbaGames ?? []).filter(
    (g: any) => g.home_moneyline != null || g.home_spread != null || g.total_line != null
  );

  // Step 2: latest model run predictions (joined on game_id)
  const { data: latestRun, error: runError } = await collegeFootballSupabase
    .from('nba_predictions')
    .select('run_id, as_of_ts_utc')
    .order('as_of_ts_utc', { ascending: false })
    .limit(1)
    .maybeSingle();

  const predictionsMap = new Map<number, any>();
  if (!runError && latestRun) {
    const gameIds = (nbaGames || []).map((g: any) => g.game_id);
    const { data: predictions, error: predsError } = await collegeFootballSupabase
      .from('nba_predictions')
      .select(
        'game_id, home_win_prob, away_win_prob, model_fair_total, home_score_pred, away_score_pred, model_fair_home_spread, run_id'
      )
      .eq('run_id', latestRun.run_id)
      .in('game_id', gameIds);

    if (!predsError && predictions) {
      predictions.forEach((pred) => predictionsMap.set(pred.game_id, pred));
    } else {
      debug.warn('No NBA predictions found or error:', predsError);
    }
  } else {
    debug.warn('No NBA prediction run_id found (table may be empty)');
  }

  // Step 3: team mappings for logos/abbreviations
  const { data: teamMappingsData, error: teamMappingsError } = await collegeFootballSupabase
    .from('nba_teams_master')
    .select('*');
  if (teamMappingsError) {
    debug.error('Error fetching NBA team mappings:', teamMappingsError);
  }
  const teamMappings: NBATeamMapping[] = (teamMappingsData || []).map((team: any) => ({
    team_id: team.team_id || team.id,
    team_name: team.team_name || team.name || team.full_name,
    abbreviation: team.abbreviation || team.abbr || team.short_name,
    logo_url: team.logo_url || team.logo || '/placeholder.svg',
  }));

  // Step 4: merge games with predictions (game_id joins both tables)
  const merged: NBAPrediction[] = (nbaGames || []).map((game: any) => {
    const prediction = predictionsMap.get(game.game_id);
    const gameIdStr = String(game.game_id);

    // nba_input_values_view now publishes away_moneyline explicitly.
    // Fall back to the complement formula only if the column is missing.
    const homeML = game.home_moneyline;
    const awayML =
      game.away_moneyline ?? (homeML ? (homeML > 0 ? -(homeML + 100) : 100 - homeML) : null);

    const vegasHomeSpread = game.home_spread;
    const modelFairHomeSpread = prediction?.model_fair_home_spread || null;
    const homeSpreadDiff =
      vegasHomeSpread !== null && modelFairHomeSpread !== null
        ? vegasHomeSpread - modelFairHomeSpread
        : null;

    const vegasTotal = game.total_line;
    const modelFairTotal = prediction?.model_fair_total || null;
    const overLineDiff =
      vegasTotal !== null && modelFairTotal !== null ? modelFairTotal - vegasTotal : null;

    // Heuristic spread-cover probability from the model-vs-Vegas spread gap
    // (5%/point, capped at 0.15..0.85); falls back to home_win_prob as proxy.
    let spreadCoverProb: number | null = null;
    if (prediction && prediction.model_fair_home_spread !== null && game.home_spread !== null) {
      const spreadDiff = Math.abs(prediction.model_fair_home_spread - game.home_spread);
      if (prediction.model_fair_home_spread < game.home_spread) {
        spreadCoverProb = 0.5 + Math.min(spreadDiff * 0.05, 0.35);
      } else {
        spreadCoverProb = 0.5 - Math.min(spreadDiff * 0.05, 0.35);
      }
    } else if (prediction?.home_win_prob) {
      spreadCoverProb = prediction.home_win_prob;
    }

    // Same heuristic for O/U (2%/point of total gap)
    let ouProb: number | null = null;
    if (prediction && prediction.model_fair_total !== null && game.total_line !== null) {
      const totalDiff = prediction.model_fair_total - game.total_line;
      if (totalDiff > 0) {
        ouProb = 0.5 + Math.min(Math.abs(totalDiff) * 0.02, 0.35);
      } else {
        ouProb = 0.5 - Math.min(Math.abs(totalDiff) * 0.02, 0.35);
      }
    }

    return {
      id: gameIdStr,
      away_team: game.away_team,
      home_team: game.home_team,
      training_key: gameIdStr,
      unique_id: gameIdStr,
      game_id: game.game_id,
      home_team_id: game.home_team_id ?? null,
      away_team_id: game.away_team_id ?? null,
      // Betting lines from input values
      home_ml: homeML,
      away_ml: awayML,
      home_spread: game.home_spread,
      away_spread: game.home_spread ? -game.home_spread : null,
      over_line: game.total_line,
      // Game date/time
      game_date: game.game_date || '',
      game_time: game.tipoff_time_et || '',
      // Prediction probabilities
      home_away_ml_prob: prediction?.home_win_prob || null,
      home_away_spread_cover_prob: spreadCoverProb,
      ou_result_prob: ouProb,
      run_id: prediction?.run_id || null,
      // Edge values (delta) - like College Basketball
      home_spread_diff: homeSpreadDiff,
      over_line_diff: overLineDiff,
      // Model predicted spread/total (for modal display)
      pred_spread: modelFairHomeSpread,
      pred_over_line: prediction?.model_fair_total || null,
      // Vegas lines for reference
      api_spread: vegasHomeSpread,
      api_over_line: vegasTotal,
      // Score predictions for match simulator
      home_score_pred: prediction?.home_score_pred || null,
      away_score_pred: prediction?.away_score_pred || null,
      // Public betting splits (not available for basketball)
      spread_splits_label: null,
      ml_splits_label: null,
      total_splits_label: null,
    };
  });

  const games: GameFeedItem<NBAPrediction>[] = merged.map((row) => ({
    sport: 'nba',
    id: row.id,
    awayTeam: teamRef(row.away_team, teamMappings),
    homeTeam: teamRef(row.home_team, teamMappings),
    gameDate: row.game_date || '',
    // Page renders convertTimeToEST(game_time) but sorts on the raw string
    gameTimeLabel: convertTimeToEST(row.game_time),
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

  return {
    games,
    extras: { teamMappings },
    fetchedAt: Date.now(),
  };
}
