import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import {
  getNflTeamAbbr,
  getNflTeamLogo,
  installNflTeamAssets,
  lookupNflTeam,
} from '@/utils/nflTeamAssets';
import type { GameFeedItem, SportFeed, TeamRef } from '../types';
import { resolveNflCurrentWeek, signalCountFromDryrunGame } from './footballSlate';

/**
 * NFL adapter for the /games feed.
 * Reads the NEW model's weekly output: nfl_dryrun_games (the locked totals/sides/1H model numbers +
 * Odds-API lines) + nfl_teams (logos/abbrs via home_ab/away_ab). The current week is resolved
 * dynamically from kickoffs (resolveNflCurrentWeek), so the slate rolls Week 1 -> Week 2
 * automatically. The legacy path (v_input_values_with_epa + nfl_predictions_epa classifier +
 * nfl_betting_lines as card lines + production_weather) is retired — nfl_betting_lines remains
 * only for the Line-Movement history widget. (nfl_dryrun_games keeps its test-era name but now
 * holds the live current-week slate.)
 */

export interface NFLPrediction {
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
  home_away_ml_prob: number | null;
  home_away_spread_cover_prob: number | null;
  ou_result_prob: number | null;
  run_id: string | null;
  temperature: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  icon: string | null;
  spread_splits_label: string | null;
  total_splits_label: string | null;
  ml_splits_label: string | null;
  home_spread_diff?: number | null;
  over_line_diff?: number | null;
  [key: string]: unknown;
}

export interface NFLTeamMapping {
  city_and_name: string;
  team_name: string;
  logo_url: string;
}

const INITIALS_MAP: Record<string, string> = {
  Arizona: 'ARI',
  Atlanta: 'ATL',
  Baltimore: 'BAL',
  Buffalo: 'BUF',
  Carolina: 'CAR',
  Chicago: 'CHI',
  Cincinnati: 'CIN',
  Cleveland: 'CLE',
  Dallas: 'DAL',
  Denver: 'DEN',
  Detroit: 'DET',
  'Green Bay': 'GB',
  Houston: 'HOU',
  Indianapolis: 'IND',
  Jacksonville: 'JAX',
  'Kansas City': 'KC',
  'Las Vegas': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR',
  'LA Chargers': 'LAC',
  'LA Rams': 'LAR',
  Miami: 'MIA',
  Minnesota: 'MIN',
  'New England': 'NE',
  'New Orleans': 'NO',
  'NY Giants': 'NYG',
  'NY Jets': 'NYJ',
  Philadelphia: 'PHI',
  Pittsburgh: 'PIT',
  'San Francisco': 'SF',
  Seattle: 'SEA',
  'Tampa Bay': 'TB',
  Tennessee: 'TEN',
  Washington: 'WSH',
};

const TEAM_NAME_MAP: Record<string, string> = {
  Arizona: 'Cardinals',
  Atlanta: 'Falcons',
  Baltimore: 'Ravens',
  Buffalo: 'Bills',
  Carolina: 'Panthers',
  Chicago: 'Bears',
  Cincinnati: 'Bengals',
  Cleveland: 'Browns',
  Dallas: 'Cowboys',
  Denver: 'Broncos',
  Detroit: 'Lions',
  'Green Bay': 'Packers',
  Houston: 'Texans',
  Indianapolis: 'Colts',
  Jacksonville: 'Jaguars',
  'Kansas City': 'Chiefs',
  'Las Vegas': 'Raiders',
  'Los Angeles Chargers': 'Chargers',
  'Los Angeles Rams': 'Rams',
  'LA Chargers': 'Chargers',
  'LA Rams': 'Rams',
  Miami: 'Dolphins',
  Minnesota: 'Vikings',
  'New England': 'Patriots',
  'New Orleans': 'Saints',
  'NY Giants': 'Giants',
  'NY Jets': 'Jets',
  Philadelphia: 'Eagles',
  Pittsburgh: 'Steelers',
  'San Francisco': '49ers',
  Seattle: 'Seahawks',
  'Tampa Bay': 'Buccaneers',
  Tennessee: 'Titans',
  Washington: 'Commanders',
};

const COLOR_MAP: Record<string, { primary: string; secondary: string }> = {
  Arizona: { primary: '#97233F', secondary: '#000000' },
  Atlanta: { primary: '#A71930', secondary: '#000000' },
  Baltimore: { primary: '#241773', secondary: '#9E7C0C' },
  Buffalo: { primary: '#00338D', secondary: '#C60C30' },
  Carolina: { primary: '#0085CA', secondary: '#101820' },
  Chicago: { primary: '#0B162A', secondary: '#C83803' },
  Cincinnati: { primary: '#FB4F14', secondary: '#000000' },
  Cleveland: { primary: '#311D00', secondary: '#FF3C00' },
  Dallas: { primary: '#003594', secondary: '#869397' },
  Denver: { primary: '#FB4F14', secondary: '#002244' },
  Detroit: { primary: '#0076B6', secondary: '#B0B7BC' },
  'Green Bay': { primary: '#203731', secondary: '#FFB612' },
  Houston: { primary: '#03202F', secondary: '#A71930' },
  Indianapolis: { primary: '#002C5F', secondary: '#A2AAAD' },
  Jacksonville: { primary: '#101820', secondary: '#D7A22A' },
  'Kansas City': { primary: '#E31837', secondary: '#FFB81C' },
  'Las Vegas': { primary: '#000000', secondary: '#A5ACAF' },
  'Los Angeles Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
  'Los Angeles Rams': { primary: '#003594', secondary: '#FFA300' },
  'LA Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
  'LA Rams': { primary: '#003594', secondary: '#FFA300' },
  Miami: { primary: '#008E97', secondary: '#FC4C02' },
  Minnesota: { primary: '#4F2683', secondary: '#FFC62F' },
  'New England': { primary: '#002244', secondary: '#C60C30' },
  'New Orleans': { primary: '#101820', secondary: '#D3BC8D' },
  'NY Giants': { primary: '#0B2265', secondary: '#A71930' },
  'NY Jets': { primary: '#125740', secondary: '#000000' },
  Philadelphia: { primary: '#004C54', secondary: '#A5ACAF' },
  Pittsburgh: { primary: '#FFB612', secondary: '#101820' },
  'San Francisco': { primary: '#AA0000', secondary: '#B3995D' },
  Seattle: { primary: '#002244', secondary: '#69BE28' },
  'Tampa Bay': { primary: '#D50A0A', secondary: '#FF7900' },
  Tennessee: { primary: '#0C2340', secondary: '#4B92DB' },
  Washington: { primary: '#5A1414', secondary: '#FFB612' },
};

const LOGO_MAP: Record<string, string> = {
  Arizona: 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
  Atlanta: 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
  Baltimore: 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
  Buffalo: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
  Carolina: 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
  Chicago: 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
  Cincinnati: 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
  Cleveland: 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
  Dallas: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
  Denver: 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
  Detroit: 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
  'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
  Houston: 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
  Indianapolis: 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
  Jacksonville: 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
  'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
  'Las Vegas': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
  'Los Angeles Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
  'Los Angeles Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
  'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
  'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
  Miami: 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
  Minnesota: 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
  'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
  'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
  'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
  'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
  Philadelphia: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
  Pittsburgh: 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
  'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
  Seattle: 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
  'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
  Tennessee: 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
  Washington: 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
};

export const getNFLTeamInitials = (teamCity: string): string => {
  const fromAssets = getNflTeamAbbr(teamCity);
  if (fromAssets) return fromAssets;
  return INITIALS_MAP[teamCity] || teamCity.substring(0, 3).toUpperCase();
};

export const getNFLFullTeamName = (teamCity: string): { city: string; name: string } => {
  const team = lookupNflTeam(teamCity);
  if (team) {
    return { city: team.linesCity, name: team.nick || '' };
  }
  return {
    city: teamCity,
    name: TEAM_NAME_MAP[teamCity] || '',
  };
};

export const getNFLTeamColors = (teamName: string): { primary: string; secondary: string } => {
  const abbr = getNflTeamAbbr(teamName);
  const city =
    (abbr &&
      ({
        ARI: 'Arizona',
        ATL: 'Atlanta',
        BAL: 'Baltimore',
        BUF: 'Buffalo',
        CAR: 'Carolina',
        CHI: 'Chicago',
        CIN: 'Cincinnati',
        CLE: 'Cleveland',
        DAL: 'Dallas',
        DEN: 'Denver',
        DET: 'Detroit',
        GB: 'Green Bay',
        HOU: 'Houston',
        IND: 'Indianapolis',
        JAX: 'Jacksonville',
        KC: 'Kansas City',
        LV: 'Las Vegas',
        LAC: 'LA Chargers',
        LA: 'LA Rams',
        LAR: 'LA Rams',
        MIA: 'Miami',
        MIN: 'Minnesota',
        NE: 'New England',
        NO: 'New Orleans',
        NYG: 'NY Giants',
        NYJ: 'NY Jets',
        PHI: 'Philadelphia',
        PIT: 'Pittsburgh',
        SF: 'San Francisco',
        SEA: 'Seattle',
        TB: 'Tampa Bay',
        TEN: 'Tennessee',
        WAS: 'Washington',
        WSH: 'Washington',
      } as Record<string, string>)[abbr]) ||
    teamName;
  return COLOR_MAP[city] || COLOR_MAP[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };
};

export const getNFLTeamLogo = (teamName: string): string =>
  getNflTeamLogo(teamName) || LOGO_MAP[teamName] || '/placeholder.svg';

const teamRef = (teamName: string, abbrHint?: string | null): TeamRef => {
  const abbr = (abbrHint && String(abbrHint).trim().toUpperCase()) || getNFLTeamInitials(teamName);
  const logo = getNflTeamLogo(abbr) || getNflTeamLogo(teamName) || getNFLTeamLogo(teamName);
  return {
    name: teamName,
    abbrev: abbr,
    logoUrl: logo,
    colors: getNFLTeamColors(abbr || teamName),
  };
};

/** Format an ISO kickoff into an ET display label (e.g. "1:00 PM EDT"). */
function formatKickoffLabel(kickoff: string | null | undefined): string {
  if (!kickoff) return '';
  try {
    const date = new Date(kickoff);
    if (Number.isNaN(date.getTime())) return kickoff;
    const time = date.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    });
    const tzName =
      formatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'ET';
    return `${time} ${tzName}`;
  } catch {
    return kickoff;
  }
}

/**
 * Derive a display-side over/under probability from the new model's total pick.
 * The dryrun table publishes `fg_total_pick` (OVER/UNDER/NEUTRAL) + edge, not a
 * classifier `ou_result_prob`. Soften NEUTRAL to null so the Total widget can
 * still render from model/vegas when a directional pick exists.
 */
function ouProbFromDryrunPick(
  pick: string | null | undefined,
  edge: number | null | undefined,
): number | null {
  const key = String(pick || '')
    .trim()
    .toUpperCase();
  if (key === 'OVER') return 0.55 + Math.min(0.2, Math.abs(Number(edge) || 0) / 50);
  if (key === 'UNDER') return 0.45 - Math.min(0.2, Math.abs(Number(edge) || 0) / 50);
  return null;
}

export async function fetchNflGames(): Promise<SportFeed<NFLPrediction>> {
  // The NEW NFL model's weekly output lives in nfl_dryrun_games (legacy test-era name; it now holds the
  // real current-week slate — Odds-API lines + the locked totals/sides/1H model numbers). The current
  // week resolves dynamically from kickoffs so the board rolls Week 1 -> Week 2 on its own. The old
  // legacy path (v_input_values_with_epa + nfl_predictions_epa classifier + nfl_betting_lines as card
  // lines) is retired; nfl_betting_lines remains only for Line-Movement history.
  const { season, week } = await resolveNflCurrentWeek();

  const [
    { data: nflGames, error: gamesError },
    { data: nflTeams, error: teamsError },
  ] = await Promise.all([
    collegeFootballSupabase
      .from('nfl_dryrun_games')
      .select('*')
      .eq('season', season)
      .eq('week', week)
      .order('kickoff', { ascending: true }),
    collegeFootballSupabase
      .from('nfl_teams')
      .select('team_abbr, team_name, team_nick, logo_espn'),
  ]);

  if (gamesError) {
    throw new Error(`Games error: ${gamesError.message}`);
  }
  if (teamsError) {
    debug.error('Error fetching NFL teams:', teamsError);
  }
  installNflTeamAssets(nflTeams || []);

  // Keep a teamMappings-shaped extras payload for detail sections that still
  // expect it (H2H / legacy consumers), now sourced from nfl_teams.
  const teamMappings: NFLTeamMapping[] = (nflTeams || []).map((team) => ({
    city_and_name: team.team_name,
    team_name: team.team_nick || team.team_name,
    logo_url: getNFLTeamLogo(team.team_abbr || team.team_name),
  }));

  // Map nfl_dryrun_games rows onto the NFLPrediction shape the cards + detail widgets read.
  const merged: NFLPrediction[] = (nflGames || []).map((r: any) => {
    const homeSpread = r.fg_spread_close ?? null;
    const total = r.fg_total_close ?? null;
    const predTotal = Number(r.fg_pred_total);
    const predMargin = Number(r.fg_pred_margin);
    const hasScore = Number.isFinite(predTotal) && Number.isFinite(predMargin);
    const totalEdge = r.fg_total_edge ?? null;
    const kickoffLabel = formatKickoffLabel(r.kickoff);
    return {
      ...r,
      id: r.game_id,
      game_id: r.game_id,
      training_key: r.game_id,
      unique_id: r.game_id,
      game_date: r.gameday || (r.kickoff ? String(r.kickoff).slice(0, 10) : ''),
      game_time: kickoffLabel || r.kickoff || '',
      // model numbers — the new model has a fair line + edges the legacy classifier never had
      home_away_ml_prob: r.fg_home_win_prob ?? null,
      home_away_spread_cover_prob: r.fg_home_cover_prob ?? null,
      ou_result_prob: ouProbFromDryrunPick(r.fg_total_pick, totalEdge),
      fg_total_pick: r.fg_total_pick ?? null,
      pred_spread: r.fg_pred_spread ?? null,
      pred_total: r.fg_pred_total ?? null,
      pred_home_score: hasScore ? (predTotal + predMargin) / 2 : (r.tt_home_pred ?? null),
      pred_away_score: hasScore ? (predTotal - predMargin) / 2 : (r.tt_away_pred ?? null),
      // Odds-API lines (the single source for displayed lines)
      home_ml: r.fg_ml_home_close ?? null,
      away_ml: r.fg_ml_away_close ?? null,
      home_spread: homeSpread,
      away_spread: homeSpread !== null ? -Number(homeSpread) : null,
      over_line: total,
      home_spread_diff: r.fg_spread_edge ?? null,
      over_line_diff: totalEdge,
      // weather (blank pre-season; populated in-season)
      temperature: r.wx_temp_f ?? null,
      precipitation: r.wx_precip_mm ?? null,
      wind_speed: r.wx_wind_mph ?? null,
      icon: r.wx_icon ?? null,
    };
  });

  const games: GameFeedItem<NFLPrediction>[] = merged.map((row) => ({
    sport: 'nfl',
    id: row.id,
    awayTeam: teamRef(row.away_team, row.away_ab as string | null | undefined),
    homeTeam: teamRef(row.home_team, row.home_ab as string | null | undefined),
    gameDate: row.game_date || '',
    gameTimeLabel: row.game_time || 'TBD',
    timeSortKey: (row.kickoff as string) || row.game_time || '',
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
    // Prefer slate flag counts (excludes blanket sides_model); never count signals[].key.
    signalCount: signalCountFromDryrunGame('nfl', row),
    raw: row,
  }));

  return {
    games,
    extras: { teamMappings },
    fetchedAt: Date.now(),
  };
}
