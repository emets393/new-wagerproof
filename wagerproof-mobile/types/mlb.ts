/**
 * MLB Game type definitions for the mobile app.
 * Mirrors the web app's MLBPredictionRow from src/pages/MLB.tsx
 */

export interface MLBGame {
  // Identity & schedule
  id: string; // derived from game_pk for list keys
  game_pk: number;
  official_date: string; // YYYY-MM-DD
  game_time_et: string | null;

  // Teams
  away_team_name: string | null;
  home_team_name: string | null;
  away_team: string | null; // alias
  home_team: string | null; // alias
  away_team_full_name: string | null;
  home_team_full_name: string | null;
  away_team_id: number | null;
  home_team_id: number | null;

  // Resolved display fields (set after team mapping)
  away_abbr: string;
  home_abbr: string;
  away_logo_url: string | null;
  home_logo_url: string | null;

  // Status
  status: string | null;
  is_postponed: boolean | null;
  is_completed: boolean | null;
  is_active: boolean | null;

  // Market lines (full game)
  away_ml: number | null;
  home_ml: number | null;
  away_spread: number | null;
  home_spread: number | null;
  total_line: number | null;

  // Full-game model outputs
  ml_home_win_prob: number | null;
  ml_away_win_prob: number | null;
  home_ml_edge_pct: number | null;
  away_ml_edge_pct: number | null;
  home_ml_strong_signal: boolean | null;
  away_ml_strong_signal: boolean | null;
  ou_edge: number | null;
  ou_direction: 'OVER' | 'UNDER' | null;
  ou_fair_total: number | null;
  ou_strong_signal: boolean | null;
  ou_moderate_signal: boolean | null;

  // First five (F5)
  f5_home_ml: number | null;
  f5_away_ml: number | null;
  f5_fair_total: number | null;
  f5_pred_margin: number | null;
  f5_total_line: number | null;
  f5_home_spread: number | null;
  f5_away_spread: number | null;
  f5_ou_edge: number | null;
  f5_home_win_prob: number | null;
  f5_away_win_prob: number | null;
  f5_home_ml_edge_pct: number | null;
  f5_away_ml_edge_pct: number | null;
  f5_home_ml_strong_signal: boolean | null;
  f5_away_ml_strong_signal: boolean | null;

  // Starters
  home_sp_name: string | null;
  away_sp_name: string | null;
  home_sp_confirmed: boolean | null;
  away_sp_confirmed: boolean | null;

  // Prediction metadata
  is_final_prediction: boolean | null;
  projection_label: string | null;

  // Weather
  weather_confirmed: boolean | null;
  weather_imputed: boolean | null;
  temperature_f: number | null;
  wind_speed_mph: number | null;
  wind_direction: string | null;
  sky: string | null;
  venue_name: string | null;

  // Signals (attached after fetch)
  signals?: MLBSignalItem[];
}

export interface MLBTeamMapping {
  mlb_api_id: number;
  team: string; // abbreviation
  team_name: string;
  logo_url: string | null;
}

export interface MLBGameSignalsRow {
  game_pk: number;
  home_signals: unknown;
  away_signals: unknown;
  game_signals: unknown;
}

export interface MLBSignalItem {
  category: string;
  severity: string;
  message: string;
}

// ── Utility functions ───────────────────────────────────────────

function toNum(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value);
}

/**
 * Full-game projected runs using Pythagorean-style split (exponent 1.83).
 * Matches the web app's getFullGameRuns exactly.
 */
export function getFullGameRuns(game: MLBGame): { home: number; away: number; margin: number } | null {
  const p = toNum(game.ml_home_win_prob);
  const total = toNum(game.ou_fair_total);
  if (p === null || total === null || p <= 0 || p >= 1) return null;

  const exp = 1.83;
  const ratio = Math.pow(p / (1 - p), 1 / exp);
  const home = total * ratio / (ratio + 1);
  const away = total / (ratio + 1);
  return { home, away, margin: home - away };
}

/**
 * First-five projected runs.
 * Matches the web app's getF5Runs exactly.
 */
export function getF5Runs(game: MLBGame): { home: number; away: number } | null {
  const total = toNum(game.f5_fair_total);
  const margin = toNum(game.f5_pred_margin);
  if (total === null || margin === null) return null;
  return {
    home: (total + margin) / 2,
    away: (total - margin) / 2,
  };
}

/** Known dome / retractable-roof stadiums. Values: 'dome' (always closed) or 'retractable'. */
const DOME_VENUES: Record<string, 'dome' | 'retractable'> = {
  'tropicana field': 'dome',
  'minute maid park': 'retractable',
  'daikin park': 'retractable', // renamed Minute Maid
  'chase field': 'retractable',
  'globe life field': 'retractable',
  'rogers centre': 'retractable',
  'loandepot park': 'retractable',
  'loanDepot park': 'retractable',
  't-mobile park': 'retractable',
  'american family field': 'retractable',
  'marlins park': 'retractable',
  'safeco field': 'retractable',
  'miller park': 'retractable',
};

/** Returns roof type for a venue, or null if open-air. */
export function getVenueRoofType(venueName: string | null | undefined): 'dome' | 'retractable' | null {
  if (!venueName) return null;
  const key = venueName.toLowerCase().trim();
  for (const [venue, type] of Object.entries(DOME_VENUES)) {
    if (key.includes(venue.toLowerCase())) return type;
  }
  return null;
}

/** Convert compass direction string to degrees (0 = N, 90 = E, etc.). */
export function windDirectionToDegrees(dir: string | null | undefined): number | null {
  if (!dir) return null;
  const map: Record<string, number> = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
    E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
    W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  return map[dir.toUpperCase().trim()] ?? null;
}

/** Get a weather icon name based on sky condition string. */
export function getSkyIcon(sky: string | null | undefined): string {
  if (!sky) return 'weather-sunny';
  const s = sky.toLowerCase();
  if (s.includes('rain') || s.includes('shower')) return 'weather-pouring';
  if (s.includes('storm') || s.includes('thunder')) return 'weather-lightning-rainy';
  if (s.includes('snow') || s.includes('flurr')) return 'weather-snowy';
  if (s.includes('overcast')) return 'weather-cloudy';
  if (s.includes('cloud') || s.includes('partly')) return 'weather-partly-cloudy';
  if (s.includes('fog') || s.includes('haz')) return 'weather-fog';
  if (s.includes('clear') || s.includes('sunny')) return 'weather-sunny';
  return 'weather-partly-cloudy';
}

/** Check if official_date is today in Eastern Time. */
export function isOfficialDateToday(officialDate: string | null | undefined): boolean {
  if (!officialDate) return false;
  const day = officialDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  return day === todayEt;
}

/** Stable map key for game_pk (handles string/number/bigint from PostgREST). */
export function gamePkMapKey(pk: unknown): string | null {
  if (pk === null || pk === undefined) return null;
  if (typeof pk === 'bigint') return pk.toString();
  const n = Number(pk);
  if (!Number.isNaN(n) && Number.isFinite(n)) return String(Math.trunc(n));
  const s = String(pk).trim();
  return s.length ? s : null;
}

/** Normalize team name for matching (trim, lowercase, strip apostrophes, collapse whitespace). */
export function normalizeTeamNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.'']/g, '')
    .replace(/\s+/g, ' ');
}

/** Build 3-letter initialism from team display name as last resort. */
export function fallbackAbbrevFromTeamName(teamName: string): string {
  const t = teamName.trim();
  if (!t) return 'MLB';
  return t
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

// ── Signal parsing ──────────────────────────────────────────────

function normalizeJsonArray(raw: unknown): unknown[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p;
      if (p && typeof p === 'object') return Object.values(p as Record<string, unknown>);
      return [];
    } catch {
      return [];
    }
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).filter((v) => v !== undefined);
  }
  return [];
}

function pickSignalMessage(o: Record<string, unknown>): string | null {
  const raw = o.message ?? o.Message ?? o.text ?? o.body ?? o.summary;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return null;
}

function pickSignalString(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.length) return v;
  }
  return '';
}

export function parseSignalArray(raw: unknown): MLBSignalItem[] {
  const arr = normalizeJsonArray(raw);
  const out: MLBSignalItem[] = [];
  for (const x of arr) {
    let item: unknown = x;
    if (typeof item === 'string') {
      try {
        item = JSON.parse(item);
      } catch {
        continue;
      }
    }
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const message = pickSignalMessage(o);
    if (!message) continue;
    out.push({
      category: pickSignalString(o, 'category', 'Category', 'type'),
      severity: pickSignalString(o, 'severity', 'Severity', 'level'),
      message,
    });
  }
  return out;
}

/** Combine signals in spec order: game -> home -> away. */
export function combineSignalsOrdered(row: MLBGameSignalsRow | undefined): MLBSignalItem[] {
  if (!row) return [];
  return [
    ...parseSignalArray(row.game_signals),
    ...parseSignalArray(row.home_signals),
    ...parseSignalArray(row.away_signals),
  ];
}

/** Format game time to ET display. */
export function formatMLBGameTime(timeString: string | null): string {
  if (!timeString) return 'TBD';
  const date = new Date(timeString);
  if (Number.isNaN(date.getTime())) return 'TBD';
  const time = date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${time} ET`;
}

/** Format date label like "Mon, Mar 25". */
export function formatMLBDateLabel(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatMoneyline(ml: number | null): string {
  if (ml === null || ml === undefined) return '-';
  return ml > 0 ? `+${ml}` : String(ml);
}

export function formatSpread(spread: number | null | undefined): string {
  if (spread === null || spread === undefined || Number.isNaN(Number(spread))) return '-';
  const n = Number(spread);
  const body = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return n > 0 ? `+${body}` : body;
}

/** Signal severity -> RN color values. */
export function getSignalSeverityColor(severity: string): { bg: string; border: string; text: string } {
  switch (severity) {
    case 'negative':
      return { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.35)', text: '#fb923c' };
    case 'positive':
      return { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.3)', text: '#4ade80' };
    case 'over':
      return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', text: '#fbbf24' };
    case 'under':
      return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)', text: '#60a5fa' };
    default:
      return { bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.25)', text: '#94a3b8' };
  }
}

/** Signal category -> MaterialCommunityIcons icon name. */
export function getSignalCategoryIcon(category: string): string {
  switch (category.toLowerCase()) {
    case 'pitcher': return 'account';
    case 'bullpen': return 'fire';
    case 'batting': return 'chart-line';
    case 'schedule': return 'calendar';
    case 'weather': return 'weather-partly-cloudy';
    case 'park': return 'map-marker';
    default: return 'target';
  }
}
