import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import type { GameFeedItem, SportFeed, TeamRef } from '../types';

/**
 * NFL adapter — port of the legacy src/pages/NFL.tsx fetchData() merge:
 * v_input_values_with_epa (current week) + nfl_predictions_epa (latest run)
 * + nfl_betting_lines (latest per training_key) + nfl_team_mapping
 * + production_weather, merged on home_away_unique = training_key.
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
  // Step 1: all current-week games
  const { data: nflGames, error: gamesError } = await collegeFootballSupabase
    .from('v_input_values_with_epa')
    .select('*')
    .order('game_date', { ascending: true })
    .order('game_time', { ascending: true });

  if (gamesError) {
    throw new Error(`Games error: ${gamesError.message}`);
  }

  // Step 2: latest model run predictions
  const { data: latestRun, error: runError } = await collegeFootballSupabase
    .from('nfl_predictions_epa')
    .select('run_id')
    .order('run_id', { ascending: false })
    .limit(1)
    .single();

  const predictionsMap = new Map<string, any>();
  if (!runError && latestRun) {
    const { data: predictions, error: predsError } = await collegeFootballSupabase
      .from('nfl_predictions_epa')
      .select('training_key, home_away_ml_prob, home_away_spread_cover_prob, ou_result_prob, run_id')
      .eq('run_id', latestRun.run_id);
    if (!predsError && predictions) {
      predictions.forEach((pred) => predictionsMap.set(pred.training_key, pred));
    } else {
      debug.warn('No NFL predictions found or error:', predsError);
    }
  } else {
    debug.warn('No NFL prediction run_id found');
  }

  // Step 2.5: latest betting line per training_key
  const { data: bettingLines, error: bettingError } = await collegeFootballSupabase
    .from('nfl_betting_lines')
    .select(
      'training_key, home_ml, away_ml, over_line, home_spread, spread_splits_label, ml_splits_label, total_splits_label, as_of_ts, game_date, game_time, game_time_et'
    )
    .order('as_of_ts', { ascending: false });

  const bettingLinesMap = new Map<string, any>();
  if (!bettingError && bettingLines) {
    bettingLines.forEach((line) => {
      if (!bettingLinesMap.has(line.training_key)) {
        bettingLinesMap.set(line.training_key, line);
      }
    });
  } else {
    debug.warn('No NFL betting lines found or error:', bettingError);
  }

  // Step 3: team mappings (logos for detail sections)
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

  // Step 3.5: weather
  const { data: weatherData, error: weatherError } = await collegeFootballSupabase
    .from('production_weather')
    .select('*');
  const weatherMap = new Map<string, any>();
  if (!weatherError && weatherData) {
    weatherData.forEach((weather) => {
      if (weather.training_key) {
        weatherMap.set(weather.training_key, weather);
      }
    });
  } else {
    debug.warn('No NFL weather data found or error:', weatherError);
  }

  // Step 4: merge (home_away_unique = training_key everywhere)
  const merged: NFLPrediction[] = (nflGames || []).map((game: any) => {
    const matchKey = game.home_away_unique;
    const prediction = predictionsMap.get(matchKey);
    const bettingLine = bettingLinesMap.get(matchKey);
    const weather = weatherMap.get(matchKey);

    const gameTime = convertGameTime(
      bettingLine?.game_time_et,
      bettingLine?.game_time || game.game_time || '',
      bettingLine?.game_date || game.game_date
    );

    const vegasHomeSpread = bettingLine?.home_spread || game.home_spread || null;
    const modelFairHomeSpread =
      (prediction as any)?.model_fair_home_spread ||
      ((prediction as any)?.pred_home_margin ? -(prediction as any).pred_home_margin : null) ||
      null;
    const homeSpreadDiff =
      vegasHomeSpread !== null && modelFairHomeSpread !== null
        ? vegasHomeSpread - modelFairHomeSpread
        : null;

    const vegasTotal = bettingLine?.over_line || game.ou_vegas_line || null;
    const modelFairTotal =
      (prediction as any)?.model_fair_total || (prediction as any)?.pred_total_points || null;
    const overLineDiff =
      vegasTotal !== null && modelFairTotal !== null ? modelFairTotal - vegasTotal : null;

    return {
      ...game,
      id: game.home_away_unique || `${game.home_team}_${game.away_team}_${game.game_date}`,
      training_key: game.home_away_unique,
      unique_id: game.home_away_unique,
      game_time: gameTime,
      game_date: bettingLine?.game_date || game.game_date || '',
      home_away_ml_prob: prediction?.home_away_ml_prob || null,
      home_away_spread_cover_prob: prediction?.home_away_spread_cover_prob || null,
      ou_result_prob: prediction?.ou_result_prob || null,
      run_id: prediction?.run_id || null,
      home_ml: bettingLine?.home_ml || null,
      away_ml: bettingLine?.away_ml || null,
      home_spread: vegasHomeSpread,
      away_spread: vegasHomeSpread !== null ? -vegasHomeSpread : null,
      over_line: vegasTotal,
      home_spread_diff: homeSpreadDiff,
      over_line_diff: overLineDiff,
      spread_splits_label: bettingLine?.spread_splits_label || null,
      ml_splits_label: bettingLine?.ml_splits_label || null,
      total_splits_label: bettingLine?.total_splits_label || null,
      temperature: game.temperature || game.weather_temp || weather?.temperature || null,
      precipitation: game.precipitation_pct || weather?.precipitation_pct || null,
      wind_speed: game.wind_speed || game.weather_wind || weather?.wind_speed || null,
      icon: game.icon || game.weather_icon || weather?.icon || null,
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
