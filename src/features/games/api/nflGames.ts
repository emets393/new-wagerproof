import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import type { GameFeedItem, SportFeed, TeamRef } from '../types';
import { resolveNflCurrentWeek } from './footballSlate';

/**
 * NFL adapter for the /games feed.
 * Reads the NEW model's weekly output: nfl_dryrun_games (the locked totals/sides/1H model numbers +
 * Odds-API lines) + nfl_team_mapping (logos). The current week is resolved dynamically from kickoffs
 * (resolveNflCurrentWeek), so the slate rolls Week 1 -> Week 2 automatically. The legacy path
 * (v_input_values_with_epa + nfl_predictions_epa classifier + nfl_betting_lines + production_weather)
 * is retired — nfl_predictions_epa now feeds only the legacy_fade signals, not the displayed card.
 * (nfl_dryrun_games keeps its test-era name but now holds the live current-week slate.)
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

export const getNFLTeamInitials = (teamCity: string): string =>
  INITIALS_MAP[teamCity] || teamCity.substring(0, 3).toUpperCase();

export const getNFLFullTeamName = (teamCity: string): { city: string; name: string } => ({
  city: teamCity,
  name: TEAM_NAME_MAP[teamCity] || '',
});

export const getNFLTeamColors = (teamName: string): { primary: string; secondary: string } =>
  COLOR_MAP[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };

export const getNFLTeamLogo = (teamName: string): string =>
  LOGO_MAP[teamName] || '/placeholder.svg';

const teamRef = (teamCity: string): TeamRef => ({
  name: teamCity,
  abbrev: getNFLTeamInitials(teamCity),
  logoUrl: getNFLTeamLogo(teamCity),
  colors: getNFLTeamColors(teamCity),
});

// Legacy time quirk (port of NFL.tsx): game_time_et is stored in EST but
// treated as UTC upstream, so the page adds 5 hours before formatting.
// Ported verbatim — do not "fix" or displayed kickoff times shift.
function convertGameTime(
  gameTimeEt: string | null | undefined,
  fallbackTime: string | null | undefined,
  fallbackDate: string | null | undefined
): string {
  let gameTime = '';
  if (gameTimeEt) {
    try {
      if (gameTimeEt.includes(' ')) {
        const [datePart, timePart] = gameTimeEt.split(' ');
        const timeStr = timePart.split('+')[0].split('-')[0];
        const [hoursStr, minutesStr] = timeStr.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr || '0', 10);

        if (!isNaN(hours) && !isNaN(minutes) && datePart) {
          const estHours = hours + 5;
          let finalDate = datePart;
          let finalHours = estHours;
          const finalMinutes = minutes;

          if (finalHours >= 24) {
            finalHours = finalHours % 24;
            const [year, month, day] = datePart.split('-').map(Number);
            const nextDay = new Date(year, month - 1, day + 1);
            finalDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
          }

          const [year, month, day] = finalDate.split('-').map(Number);
          const date = new Date(
            `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}:00-05:00`
          );

          if (!isNaN(date.getTime())) {
            gameTime = date.toLocaleTimeString('en-US', {
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
            gameTime = `${gameTime} ${tzName}`;
          }
        }
      }
    } catch (error) {
      debug.error('Error converting game_time_et:', error, gameTimeEt);
    }
  }

  if (!gameTime && fallbackTime) {
    try {
      const parts = fallbackTime.split(':');
      if (parts.length >= 2) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        if (!isNaN(hours) && !isNaN(minutes) && fallbackDate) {
          const estHours = hours + 5;
          const [year, month, day] = fallbackDate.split('-').map(Number);
          let finalDate = fallbackDate;
          const finalHours = estHours >= 24 ? estHours % 24 : estHours;
          if (estHours >= 24) {
            const nextDay = new Date(year, month - 1, day + 1);
            finalDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
          }
          const [fYear, fMonth, fDay] = finalDate.split('-').map(Number);
          const date = new Date(
            `${fYear}-${String(fMonth).padStart(2, '0')}-${String(fDay).padStart(2, '0')}T${String(finalHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`
          );
          if (!isNaN(date.getTime())) {
            gameTime = date.toLocaleTimeString('en-US', {
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              timeZoneName: 'short',
            });
            const tzParts = formatter.formatToParts(date);
            const tzName = tzParts.find((part) => part.type === 'timeZoneName')?.value || 'EST';
            gameTime = `${gameTime} ${tzName}`;
          }
        }
      }
      if (!gameTime) {
        gameTime = fallbackTime;
      }
    } catch (error) {
      debug.error('Error processing fallback time:', error);
      gameTime = fallbackTime;
    }
  }

  return gameTime;
}

export async function fetchNflGames(): Promise<SportFeed<NFLPrediction>> {
  // The NEW NFL model's weekly output lives in nfl_dryrun_games (legacy test-era name; it now holds the
  // real current-week slate — Odds-API lines + the locked totals/sides/1H model numbers). The current
  // week resolves dynamically from kickoffs so the board rolls Week 1 -> Week 2 on its own. The old
  // legacy path (v_input_values_with_epa + nfl_predictions_epa classifier + nfl_betting_lines) is
  // retired; nfl_predictions_epa now feeds only the legacy_fade signals, not the displayed card.
  const { season, week } = await resolveNflCurrentWeek();

  const { data: nflGames, error: gamesError } = await collegeFootballSupabase
    .from('nfl_dryrun_games')
    .select('*')
    .eq('season', season)
    .eq('week', week)
    .order('kickoff', { ascending: true });
  if (gamesError) {
    throw new Error(`Games error: ${gamesError.message}`);
  }

  // team mappings (logos for detail sections) — static reference, season-independent
  const { data: teamMappingsData, error: teamMappingsError } = await collegeFootballSupabase
    .from('nfl_team_mapping')
    .select('city_and_name, team_name');
  if (teamMappingsError) {
    debug.error('Error fetching NFL team mappings:', teamMappingsError);
  }
  const teamMappings: NFLTeamMapping[] = (teamMappingsData || []).map((team) => ({
    ...team,
    logo_url: getNFLTeamLogo(team.team_name),
  }));

  // Map nfl_dryrun_games rows onto the NFLPrediction shape the cards + detail widgets read.
  const merged: NFLPrediction[] = (nflGames || []).map((r: any) => {
    const homeSpread = r.fg_spread_close ?? null;
    const total = r.fg_total_close ?? null;
    const predTotal = Number(r.fg_pred_total);
    const predMargin = Number(r.fg_pred_margin);
    const hasScore = Number.isFinite(predTotal) && Number.isFinite(predMargin);
    return {
      ...r,
      id: r.game_id,
      training_key: r.game_id,
      unique_id: r.game_id,
      game_date: r.gameday || (r.kickoff ? String(r.kickoff).slice(0, 10) : ''),
      game_time: r.kickoff || '',
      // model numbers — the new model has a fair line + edges the legacy classifier never had
      home_away_ml_prob: r.fg_home_win_prob ?? null,
      home_away_spread_cover_prob: r.fg_home_cover_prob ?? null,
      ou_result_prob: null,
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
      over_line_diff: r.fg_total_edge ?? null,
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
    awayTeam: teamRef(row.away_team),
    homeTeam: teamRef(row.home_team),
    gameDate: row.game_date || '',
    gameTimeLabel: row.game_time || 'TBD',
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
