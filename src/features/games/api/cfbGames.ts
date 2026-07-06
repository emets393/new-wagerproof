import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import type { GameFeedItem, SportFeed, TeamRef } from '../types';

/**
 * CFB adapter — port of the legacy src/pages/CollegeFootball.tsx fetchData().
 * Two modes, selected by the page's admin toggle:
 * - dry-run (admin): cfb_teams + cfb_dryrun_games (week 7), rows synthesized
 *   into the card shape with mammoth/conviction fields kept on raw
 * - regular: cfb_team_mapping + cfb_live_weekly_inputs + cfb_api_predictions
 *   merged on row id
 */

export interface CFBPrediction {
  id: string;
  game_id?: string;
  away_team: string;
  home_team: string;
  away_abbr?: string;
  home_abbr?: string;
  away_logo?: string;
  home_logo?: string;
  away_color?: string | null;
  home_color?: string | null;
  away_alt_color?: string | null;
  home_alt_color?: string | null;
  away_rank?: number | null;
  home_rank?: number | null;
  away_conf?: string | null;
  home_conf?: string | null;
  kickoff?: string | null;
  week?: number | null;
  conviction_summary?: Array<{ card?: string; conviction?: string; mammoth?: boolean }> | null;
  conviction_tier?: string | null;
  mammoth?: boolean | null;
  fg_spread_close?: number | null;
  fg_total_close?: number | null;
  fg_ml_home_close?: number | null;
  fg_ml_away_close?: number | null;
  fg_pred_total?: number | null;
  fg_pred_margin?: number | null;
  fg_pred_spread?: number | null;
  fg_spread_edge?: number | null;
  fg_total_edge?: number | null;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  total_line: number | null;
  over_line?: number | null;
  ml_splits_label: string | null;
  spread_splits_label: string | null;
  total_splits_label: string | null;
  game_date?: string;
  game_time?: string;
  start_time?: string; // Date/time from cfb_live_weekly_inputs
  start_date?: string; // Alternative column name
  game_datetime?: string; // Alternative column name
  datetime?: string; // Alternative column name
  // Columns from cfb_live_weekly_inputs
  away_moneyline?: number | null;
  home_moneyline?: number | null;
  api_spread?: number | null;
  api_over_line?: number | null;
  generated_at?: string;
  training_key?: string;
  temperature?: number | null;
  precipitation?: number | null;
  wind_speed?: number | null;
  icon_code?: string | null;
  weather_icon_text?: string | null;
  weather_temp_f?: number | null;
  weather_windspeed_mph?: number | null;
  pred_ml_proba?: number | null;
  pred_spread_proba?: number | null;
  pred_total_proba?: number | null;
  pred_away_score?: number | null;
  pred_home_score?: number | null;
  pred_away_points?: number | null;
  pred_home_points?: number | null;
  // Prediction data from cfb_api_predictions
  pred_spread?: number | null;
  home_spread_diff?: number | null;
  pred_total?: number | null;
  total_diff?: number | null;
  pred_over_line?: number | null;
  over_line_diff?: number | null;
  // Opening spread from cfb_live_weekly_inputs (column: spread)
  opening_spread?: number | null;
  /** Adapter discriminator: true when the row came from cfb_dryrun_games (admin mode). */
  is_dry_run?: boolean;
  [key: string]: unknown;
}

/** Union of cfb_teams (dry-run) and cfb_team_mapping (regular) row shapes. */
export interface CFBTeamMapping {
  api?: string;
  team_name?: string;
  abbr?: string;
  logo?: string;
  logo_dark?: string;
  logo_light?: string;
  color?: string;
  alt_color?: string;
  conference?: string;
}

const INITIALS_MAP: Record<string, string> = {
  // Major conferences and common teams
  Alabama: 'ALA',
  Auburn: 'AUB',
  Georgia: 'UGA',
  Florida: 'UF',
  LSU: 'LSU',
  'Texas A&M': 'TAMU',
  'Ole Miss': 'MISS',
  'Mississippi State': 'MSST',
  Arkansas: 'ARK',
  Kentucky: 'UK',
  Tennessee: 'TENN',
  'South Carolina': 'SC',
  Missouri: 'MIZ',
  Vanderbilt: 'VAN',

  'Ohio State': 'OSU',
  Michigan: 'MICH',
  'Penn State': 'PSU',
  'Michigan State': 'MSU',
  Wisconsin: 'WISC',
  Iowa: 'IOWA',
  Minnesota: 'MINN',
  Nebraska: 'NEB',
  Illinois: 'ILL',
  Northwestern: 'NW',
  Purdue: 'PUR',
  Indiana: 'IND',
  Rutgers: 'RUT',
  Maryland: 'MD',

  Oklahoma: 'OU',
  Texas: 'TEX',
  'Oklahoma State': 'OKST',
  Baylor: 'BAY',
  TCU: 'TCU',
  'Texas Tech': 'TTU',
  'Kansas State': 'KSU',
  'Iowa State': 'ISU',
  Kansas: 'KU',
  'West Virginia': 'WVU',
  BYU: 'BYU',
  Cincinnati: 'CIN',
  UCF: 'UCF',
  Houston: 'HOU',

  USC: 'USC',
  UCLA: 'UCLA',
  Oregon: 'ORE',
  Washington: 'UW',
  Utah: 'UTAH',
  'Arizona State': 'ASU',
  Arizona: 'ARIZ',
  Colorado: 'COLO',
  Stanford: 'STAN',
  California: 'CAL',
  'Oregon State': 'ORST',
  'Washington State': 'WSU',

  Clemson: 'CLEM',
  'Florida State': 'FSU',
  Miami: 'MIA',
  'North Carolina': 'UNC',
  'NC State': 'NCST',
  'Virginia Tech': 'VT',
  Virginia: 'UVA',
  Duke: 'DUKE',
  'Wake Forest': 'WAKE',
  'Georgia Tech': 'GT',
  'Boston College': 'BC',
  Pitt: 'PITT',
  Syracuse: 'SYR',
  Louisville: 'LOU',

  'Notre Dame': 'ND',
  Army: 'ARMY',
  Navy: 'NAVY',
  'Air Force': 'AF',

  // Additional common teams
  'Boise State': 'BSU',
  'San Diego State': 'SDSU',
  'Fresno State': 'FRES',
  'Utah State': 'USU',
  Wyoming: 'WYO',
  'Colorado State': 'CSU',
  Nevada: 'NEV',
  UNLV: 'UNLV',
  'New Mexico': 'UNM',
  Hawaii: 'HAW',
  'San Jose State': 'SJSU',

  Memphis: 'MEM',
  SMU: 'SMU',
  Tulane: 'TUL',
  Tulsa: 'TULSA',
  'East Carolina': 'ECU',
  Temple: 'TEMP',
  'South Florida': 'USF',
  Charlotte: 'CHAR',
  'Florida Atlantic': 'FAU',
  'Florida International': 'FIU',
  Marshall: 'MRSH',
  'Old Dominion': 'ODU',
  'Middle Tennessee': 'MTSU',
  'Western Kentucky': 'WKU',
  'North Texas': 'UNT',
  UTSA: 'UTSA',
  Rice: 'RICE',
  'Louisiana Tech': 'LAT',
  'Southern Miss': 'USM',
  UTEP: 'UTEP',
  'New Mexico State': 'NMSU',
  Liberty: 'LIB',
  'James Madison': 'JMU',
  'Appalachian State': 'APP',
  'Coastal Carolina': 'CCU',
  'Georgia Southern': 'GASO',
  'Georgia State': 'GSU',
  Troy: 'TROY',
  'South Alabama': 'USA',
  Louisiana: 'UL',
  'Louisiana Monroe': 'ULM',
  'Arkansas State': 'ARST',
  'Texas State': 'TXST',

  Buffalo: 'BUFF',
  Akron: 'AKR',
  'Kent State': 'KENT',
  Ohio: 'OHIO',
  'Miami (OH)': 'MOH',
  'Bowling Green': 'BGSU',
  Toledo: 'TOL',
  'Central Michigan': 'CMU',
  'Eastern Michigan': 'EMU',
  'Western Michigan': 'WMU',
  'Northern Illinois': 'NIU',
  'Ball State': 'BALL',
};

const COLOR_MAP: Record<string, { primary: string; secondary: string }> = {
  // SEC
  Alabama: { primary: '#9E1B32', secondary: '#FFFFFF' },
  Auburn: { primary: '#0C2340', secondary: '#E87722' },
  Georgia: { primary: '#BA0C2F', secondary: '#000000' },
  Florida: { primary: '#0021A5', secondary: '#FA4616' },
  LSU: { primary: '#461D7C', secondary: '#FDD023' },
  'Texas A&M': { primary: '#500000', secondary: '#FFFFFF' },
  'Ole Miss': { primary: '#CE1126', secondary: '#14213D' },
  'Mississippi State': { primary: '#5D1725', secondary: '#FFFFFF' },
  Arkansas: { primary: '#9D2235', secondary: '#FFFFFF' },
  Kentucky: { primary: '#0033A0', secondary: '#FFFFFF' },
  Tennessee: { primary: '#FF8200', secondary: '#FFFFFF' },
  'South Carolina': { primary: '#73000A', secondary: '#000000' },
  Missouri: { primary: '#F1B82D', secondary: '#000000' },
  Vanderbilt: { primary: '#866D4B', secondary: '#000000' },

  // Big Ten
  'Ohio State': { primary: '#BB0000', secondary: '#666666' },
  Michigan: { primary: '#00274C', secondary: '#FFCB05' },
  'Penn State': { primary: '#041E42', secondary: '#FFFFFF' },
  'Michigan State': { primary: '#18453B', secondary: '#FFFFFF' },
  Wisconsin: { primary: '#C5050C', secondary: '#FFFFFF' },
  Iowa: { primary: '#FFCD00', secondary: '#000000' },
  Minnesota: { primary: '#7A0019', secondary: '#FFCC33' },
  Nebraska: { primary: '#E41C38', secondary: '#FFFFFF' },
  Illinois: { primary: '#13294B', secondary: '#E84A27' },
  Northwestern: { primary: '#4E2A84', secondary: '#FFFFFF' },
  Purdue: { primary: '#000000', secondary: '#CFB991' },
  Indiana: { primary: '#990000', secondary: '#FFFFFF' },
  Rutgers: { primary: '#CC0033', secondary: '#FFFFFF' },
  Maryland: { primary: '#E03A3E', secondary: '#FFD520' },

  // Big 12
  Oklahoma: { primary: '#841617', secondary: '#FDF9D8' },
  Texas: { primary: '#BF5700', secondary: '#FFFFFF' },
  'Oklahoma State': { primary: '#FF6600', secondary: '#000000' },
  Baylor: { primary: '#003015', secondary: '#FFB81C' },
  TCU: { primary: '#4D1979', secondary: '#A3A9AC' },
  'Texas Tech': { primary: '#CC0000', secondary: '#000000' },
  'Kansas State': { primary: '#512888', secondary: '#FFFFFF' },
  'Iowa State': { primary: '#C8102E', secondary: '#F1BE48' },
  Kansas: { primary: '#0051BA', secondary: '#E8000D' },
  'West Virginia': { primary: '#002855', secondary: '#EAAA00' },
  BYU: { primary: '#002E5D', secondary: '#FFFFFF' },
  Cincinnati: { primary: '#E00122', secondary: '#000000' },
  UCF: { primary: '#BA9B37', secondary: '#000000' },
  Houston: { primary: '#C8102E', secondary: '#FFFFFF' },

  // ACC
  Clemson: { primary: '#F56600', secondary: '#522D80' },
  'Florida State': { primary: '#782F40', secondary: '#CEB888' },
  Miami: { primary: '#F47321', secondary: '#005030' },
  'North Carolina': { primary: '#7BAFD4', secondary: '#13294B' },
  'NC State': { primary: '#CC0000', secondary: '#FFFFFF' },
  'Virginia Tech': { primary: '#630031', secondary: '#CF4420' },
  Virginia: { primary: '#232D4B', secondary: '#E57200' },
  Duke: { primary: '#003087', secondary: '#FFFFFF' },
  'Wake Forest': { primary: '#9E7E38', secondary: '#000000' },
  'Georgia Tech': { primary: '#B3A369', secondary: '#003057' },
  'Boston College': { primary: '#98002E', secondary: '#FFB81C' },
  Pitt: { primary: '#003594', secondary: '#FFB81C' },
  Syracuse: { primary: '#F76900', secondary: '#000E54' },
  Louisville: { primary: '#AD0000', secondary: '#000000' },

  // Pac-12
  USC: { primary: '#990000', secondary: '#FFCC00' },
  UCLA: { primary: '#2D68C4', secondary: '#FFD100' },
  Oregon: { primary: '#007030', secondary: '#FEE123' },
  Washington: { primary: '#4B2E83', secondary: '#B7A57A' },
  Utah: { primary: '#CC0000', secondary: '#FFFFFF' },
  'Arizona State': { primary: '#8C1D40', secondary: '#FFC627' },
  Arizona: { primary: '#003366', secondary: '#CC0033' },
  Colorado: { primary: '#000000', secondary: '#CFB87C' },
  Stanford: { primary: '#8C1515', secondary: '#FFFFFF' },
  California: { primary: '#003262', secondary: '#FDB515' },
  'Oregon State': { primary: '#DC4405', secondary: '#000000' },
  'Washington State': { primary: '#981E32', secondary: '#5E6A71' },

  // Independents
  'Notre Dame': { primary: '#0C2340', secondary: '#C99700' },
  Army: { primary: '#000000', secondary: '#D4AF37' },
  Navy: { primary: '#000080', secondary: '#C5B783' },

  // Other notable programs
  'Boise State': { primary: '#0033A0', secondary: '#D64309' },
  'San Diego State': { primary: '#A6192E', secondary: '#000000' },
  'Fresno State': { primary: '#DB0032', secondary: '#003A70' },
  'Utah State': { primary: '#003057', secondary: '#FFFFFF' },
  Wyoming: { primary: '#492F24', secondary: '#FFC425' },
  'Colorado State': { primary: '#1E4D2B', secondary: '#C8C372' },
  Nevada: { primary: '#003366', secondary: '#A2AAAD' },
  UNLV: { primary: '#CF0A2C', secondary: '#A7A8AA' },
  'New Mexico': { primary: '#BA0C2F', secondary: '#A7A8AA' },
  Hawaii: { primary: '#024731', secondary: '#FFFFFF' },
  'San Jose State': { primary: '#0055A2', secondary: '#E5A823' },

  Memphis: { primary: '#003087', secondary: '#808285' },
  SMU: { primary: '#CC0033', secondary: '#0033A0' },
  Tulane: { primary: '#006747', secondary: '#418FDE' },
  Tulsa: { primary: '#002D72', secondary: '#C8102E' },
  'East Carolina': { primary: '#592A8A', secondary: '#FFC845' },
  Temple: { primary: '#9D2235', secondary: '#FFFFFF' },
  'South Florida': { primary: '#006747', secondary: '#CFC493' },
  Charlotte: { primary: '#046A38', secondary: '#FFFFFF' },
  'Florida Atlantic': { primary: '#003366', secondary: '#CC0000' },
  'Florida International': { primary: '#081E3F', secondary: '#B6862C' },
  Marshall: { primary: '#00B140', secondary: '#FFFFFF' },
  'Old Dominion': { primary: '#003057', secondary: '#A2AAAD' },
  'Middle Tennessee': { primary: '#0066CC', secondary: '#FFFFFF' },
  'Western Kentucky': { primary: '#C8102E', secondary: '#FFFFFF' },
  'North Texas': { primary: '#00853E', secondary: '#FFFFFF' },
  UTSA: { primary: '#0C2340', secondary: '#F15A22' },
  Rice: { primary: '#00205B', secondary: '#8996A0' },
  'Louisiana Tech': { primary: '#00338D', secondary: '#EB1C2D' },
  'Southern Miss': { primary: '#FFAA3C', secondary: '#000000' },
  UTEP: { primary: '#FF8200', secondary: '#041E42' },
  'New Mexico State': { primary: '#BA0C2F', secondary: '#FFFFFF' },
  Liberty: { primary: '#002D72', secondary: '#C8102E' },
  'James Madison': { primary: '#450084', secondary: '#FFB612' },
  'Appalachian State': { primary: '#000000', secondary: '#FFCC00' },
  'Coastal Carolina': { primary: '#006F71', secondary: '#A27752' },
  'Georgia Southern': { primary: '#003A70', secondary: '#FFFFFF' },
  'Georgia State': { primary: '#0033A0', secondary: '#C8102E' },
  Troy: { primary: '#8B0015', secondary: '#A7A8AA' },
  'South Alabama': { primary: '#004B8D', secondary: '#C8102E' },
  Louisiana: { primary: '#CE181E', secondary: '#FFFFFF' },
  'Louisiana Monroe': { primary: '#8B0015', secondary: '#FFC82E' },
  'Arkansas State': { primary: '#CC092F', secondary: '#000000' },
  'Texas State': { primary: '#501214', secondary: '#B29369' },

  Buffalo: { primary: '#005BBB', secondary: '#FFFFFF' },
  Akron: { primary: '#041E42', secondary: '#A89968' },
  'Kent State': { primary: '#002664', secondary: '#EEB111' },
  Ohio: { primary: '#00694E', secondary: '#FFFFFF' },
  'Miami (OH)': { primary: '#C8102E', secondary: '#FFFFFF' },
  'Bowling Green': { primary: '#FE5000', secondary: '#4F2C1D' },
  Toledo: { primary: '#003E7E', secondary: '#F7B718' },
  'Central Michigan': { primary: '#6A0032', secondary: '#FFC82E' },
  'Eastern Michigan': { primary: '#006633', secondary: '#FFFFFF' },
  'Western Michigan': { primary: '#5B4638', secondary: '#FFCB05' },
  'Northern Illinois': { primary: '#BA0C2F', secondary: '#000000' },
  'Ball State': { primary: '#BA0C2F', secondary: '#FFFFFF' },
};

export const getCFBTeamInitials = (teamName: string): string =>
  INITIALS_MAP[teamName] || teamName.substring(0, 4).toUpperCase();

export const getCFBTeamColors = (teamName: string): { primary: string; secondary: string } =>
  COLOR_MAP[teamName] || { primary: '#6B7280', secondary: '#9CA3AF' };

/** Port of the page's getTeamLogo(): exact → case-insensitive → partial match. */
export const getCFBTeamLogo = (teamName: string, teamMappings: CFBTeamMapping[]): string => {
  if (!teamMappings || teamMappings.length === 0) {
    return '';
  }

  let mapping = teamMappings.find((m) => m.team_name === teamName || m.api === teamName);

  if (!mapping) {
    const lowerTeamName = teamName.toLowerCase();
    mapping = teamMappings.find((m) => {
      const name = m.team_name || m.api;
      return !!name && name.toLowerCase() === lowerTeamName;
    });
  }

  if (!mapping) {
    const lowerTeamName = teamName.toLowerCase();
    mapping = teamMappings.find((m) => {
      const name = m.team_name || m.api;
      if (!name) return false;
      const lowerApi = name.toLowerCase();
      return lowerTeamName.includes(lowerApi) || lowerApi.includes(lowerTeamName);
    });
  }

  return mapping?.logo || mapping?.logo_dark || mapping?.logo_light || '';
};

// Port of the page's memoized formatStartTime: UTC timestamp → ET date/time labels.
const startTimeCache = new Map<string, { date: string; time: string }>();
function formatStartTime(startTimeString: string | null | undefined): { date: string; time: string } {
  if (!startTimeString) {
    return { date: 'TBD', time: 'TBD' };
  }
  if (startTimeCache.has(startTimeString)) {
    return startTimeCache.get(startTimeString)!;
  }

  try {
    // Parse the start_time string (format: "2025-10-03 01:00:00+00")
    const utcDate = new Date(startTimeString);

    const estMonth = utcDate
      .toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short' })
      .toUpperCase();
    const estDay = utcDate.toLocaleString('en-US', { timeZone: 'America/New_York', day: 'numeric' });
    const estYear = utcDate.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric' });
    const estDate = `${estMonth} ${estDay}, ${estYear}`;

    const estTime =
      utcDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }) + ' EST';

    const result = { date: estDate, time: estTime };
    startTimeCache.set(startTimeString, result);
    return result;
  } catch (error) {
    debug.error('Error formatting start time:', error);
    const fallback = { date: 'TBD', time: 'TBD' };
    startTimeCache.set(startTimeString, fallback);
    return fallback;
  }
}

// ET calendar date (YYYY-MM-DD) from a timestamp — port of the page's
// isGameCurrentOrFuture date derivation; '' when missing/unparseable.
function toEtDateString(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  try {
    const gameDate = new Date(timeStr);
    if (isNaN(gameDate.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(gameDate);
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

const toTeamRef = (
  name: string,
  row: CFBPrediction,
  side: 'away' | 'home',
  teamMappings: CFBTeamMapping[]
): TeamRef => {
  const fallbackColors = getCFBTeamColors(name);
  const rowColor = side === 'away' ? row.away_color : row.home_color;
  const rowAltColor = side === 'away' ? row.away_alt_color : row.home_alt_color;
  const rowAbbr = side === 'away' ? row.away_abbr : row.home_abbr;
  // Dry-run rows carry cfb_teams logos baked in; regular mode resolves via
  // cfb_team_mapping lookup (exact/ci/partial), matching the page.
  const logo = row.is_dry_run
    ? (side === 'away' ? row.away_logo : row.home_logo) || ''
    : getCFBTeamLogo(name, teamMappings);

  return {
    name,
    abbrev: rowAbbr || getCFBTeamInitials(name),
    logoUrl: logo || null,
    colors: {
      primary: rowColor || fallbackColors.primary,
      secondary: rowAltColor || fallbackColors.secondary,
    },
  };
};

export async function fetchCfbGames(adminMode: boolean): Promise<SportFeed<CFBPrediction>> {
  let merged: CFBPrediction[] = [];
  let mappings: CFBTeamMapping[] = [];
  let generatedAt: string | null = null;

  if (adminMode) {
    // Dry-run CFB uses the normalized team table, not the legacy mapping.
    const { data: dryRunMappings, error: mappingsError } = await collegeFootballSupabase
      .from('cfb_teams')
      .select('team_name, abbr, logo, logo_dark, color, alt_color, conference');

    if (mappingsError) {
      throw new Error(`Team mappings error: ${mappingsError.message}`);
    }

    mappings = dryRunMappings || [];

    // Week hardcoded to 7 in the legacy page — kept verbatim.
    const { data: preds, error: predsError } = await collegeFootballSupabase
      .from('cfb_dryrun_games')
      .select('*')
      .eq('week', 7)
      .order('kickoff', { ascending: true });

    if (predsError) {
      throw new Error(`Predictions error: ${predsError.message}`);
    }

    const teamByName = new Map(
      mappings.map((team) => [String(team.team_name || '').toLowerCase(), team])
    );
    merged = (preds || []).map((prediction: any) => {
      const awayTeam = teamByName.get(String(prediction.away_team || '').toLowerCase());
      const homeTeam = teamByName.get(String(prediction.home_team || '').toLowerCase());
      const predTotal = Number(prediction.fg_pred_total);
      const predMargin = Number(prediction.fg_pred_margin);
      const hasScore = Number.isFinite(predTotal) && Number.isFinite(predMargin);
      const predHomeScore = hasScore ? (predTotal + predMargin) / 2 : null;
      const predAwayScore = hasScore ? (predTotal - predMargin) / 2 : null;
      const homeSpread = prediction.fg_spread_close ?? null;

      return {
        ...prediction,
        id: prediction.game_id,
        game_id: prediction.game_id,
        kickoff: prediction.kickoff,
        start_time: prediction.kickoff,
        game_date: prediction.kickoff,
        game_time: prediction.kickoff,
        away_abbr: awayTeam?.abbr || prediction.away_team,
        home_abbr: homeTeam?.abbr || prediction.home_team,
        away_logo: awayTeam?.logo || awayTeam?.logo_dark || '',
        home_logo: homeTeam?.logo || homeTeam?.logo_dark || '',
        away_color: awayTeam?.color || null,
        home_color: homeTeam?.color || null,
        away_alt_color: awayTeam?.alt_color || null,
        home_alt_color: homeTeam?.alt_color || null,
        home_spread: homeSpread,
        away_spread: homeSpread !== null ? -Number(homeSpread) : null,
        api_spread: homeSpread,
        over_line: prediction.fg_total_close ?? null,
        total_line: prediction.fg_total_close ?? null,
        api_over_line: prediction.fg_total_close ?? null,
        home_ml: prediction.fg_ml_home_close ?? null,
        away_ml: prediction.fg_ml_away_close ?? null,
        home_moneyline: prediction.fg_ml_home_close ?? null,
        away_moneyline: prediction.fg_ml_away_close ?? null,
        pred_home_score: predHomeScore,
        pred_away_score: predAwayScore,
        pred_home_points: predHomeScore,
        pred_away_points: predAwayScore,
        pred_over_line: prediction.fg_pred_total ?? null,
        over_line_diff: prediction.fg_total_edge ?? null,
        pred_spread: prediction.fg_pred_spread ?? null,
        home_spread_diff: prediction.fg_spread_edge ?? null,
        is_dry_run: true,
      };
    });
    generatedAt = (preds as any[])?.[0]?.generated_at ?? null;
  } else {
    const { data: legacyMappings, error: mappingsError } = await collegeFootballSupabase
      .from('cfb_team_mapping')
      .select('api, logo_light');

    if (mappingsError) {
      throw new Error(`Team mappings error: ${mappingsError.message}`);
    }

    mappings = legacyMappings || [];

    const { data: preds, error: predsError } = await collegeFootballSupabase
      .from('cfb_live_weekly_inputs')
      .select('*');

    if (predsError) {
      throw new Error(`Predictions error: ${predsError.message}`);
    }

    const { data: apiPreds, error: apiPredsError } = await collegeFootballSupabase
      .from('cfb_api_predictions')
      .select('*');

    if (apiPredsError) {
      throw new Error(`API predictions error: ${apiPredsError.message}`);
    }

    merged = (preds || []).map((prediction: any) => {
      const apiPred: any = apiPreds?.find((ap: any) => ap.id === prediction.id);
      return {
        ...prediction,
        opening_spread: prediction?.spread ?? null,
        pred_spread:
          apiPred?.pred_spread || apiPred?.run_line_prediction || apiPred?.spread_prediction || null,
        home_spread_diff:
          apiPred?.home_spread_diff || apiPred?.spread_diff || apiPred?.edge || null,
        pred_total:
          apiPred?.pred_total || apiPred?.total_prediction || apiPred?.ou_prediction || null,
        total_diff: apiPred?.total_diff || apiPred?.total_edge || null,
        pred_over_line: apiPred?.pred_over_line ?? null,
        over_line_diff: apiPred?.over_line_diff ?? null,
        pred_away_score:
          apiPred?.pred_away_score ?? apiPred?.away_points ?? prediction?.pred_away_score ?? null,
        pred_home_score:
          apiPred?.pred_home_score ?? apiPred?.home_points ?? prediction?.pred_home_score ?? null,
        pred_away_points: apiPred?.pred_away_points ?? apiPred?.away_points ?? null,
        pred_home_points: apiPred?.pred_home_points ?? apiPred?.home_points ?? null,
        is_dry_run: false,
      };
    });
    generatedAt = (preds as any[])?.[0]?.generated_at ?? null;
  }

  const games: GameFeedItem<CFBPrediction>[] = merged.map((row) => {
    // Sort chain includes kickoff (dry-run); the card's display chain does not.
    const sortTimeStr =
      row.kickoff || row.start_time || row.start_date || row.game_datetime || row.datetime || '';
    const displayTimeStr =
      row.start_time || row.start_date || row.game_datetime || row.datetime || '';

    return {
      sport: 'cfb' as const,
      id: String(row.id),
      awayTeam: toTeamRef(row.away_team, row, 'away', mappings),
      homeTeam: toTeamRef(row.home_team, row, 'home', mappings),
      gameDate: toEtDateString(sortTimeStr),
      gameTimeLabel: displayTimeStr ? formatStartTime(displayTimeStr).time : 'TBD',
      timeSortKey: sortTimeStr,
      status: 'scheduled' as const,
      lines: {
        homeML: row.home_moneyline ?? null,
        awayML: row.away_moneyline ?? null,
        homeSpread: row.api_spread ?? null,
        // Page quirk: falsy check, so a 0 spread maps to null.
        awaySpread: row.api_spread ? -row.api_spread : null,
        total: row.api_over_line ?? null,
      },
      edges: {
        spreadEdge: row.home_spread_diff ?? null,
        totalEdge: row.over_line_diff ?? null,
        // Regular rows may carry pred_ml_proba from cfb_live_weekly_inputs;
        // dry-run conviction data doesn't map to a probability — lives in raw.
        mlProb: row.pred_ml_proba ?? null,
      },
      raw: row,
    };
  });

  return {
    games,
    extras: {
      teamMappings: mappings,
      mode: adminMode ? 'dryrun' : 'regular',
      generatedAt,
    },
    fetchedAt: Date.now(),
  };
}
