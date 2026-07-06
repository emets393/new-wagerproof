import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import {
  buildMlbTeamMappingMaps,
  normalizeTeamNameKey,
  resolveMlbTeamDisplay,
  supplementalMlbLogoUrl,
  type MlbTeamMappingRow,
} from '@/utils/mlbTeamLogos';
import { getMLBTeamColors } from '@/utils/teamColors';
import type { GameFeedItem, SportFeed, TeamRef } from '../types';

/**
 * MLB adapter — port of the legacy src/pages/MLB.tsx fetchData() merge:
 * mlb_games_today + mlb_team_mapping + mlb_predictions_current
 * (is_final_prediction / F5 ML edge overrides) + mlb_game_signals,
 * keyed on game_pk.
 */

export interface MLBPredictionRow {
  id: number | null;
  game_pk: number;
  official_date: string;
  game_time_et: string | null;
  is_active: boolean | null;
  is_completed: boolean | null;
  is_postponed: boolean | null;
  status: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_name: string | null;
  away_team_name: string | null;
  home_ml: number | null;
  away_ml: number | null;
  home_spread: number | null;
  away_spread: number | null;
  total_line: number | null;
  ml_home_win_prob: number | null;
  ml_away_win_prob: number | null;
  home_ml_edge_pct: number | null;
  away_ml_edge_pct: number | null;
  ou_edge: number | null;
  ou_direction: 'OVER' | 'UNDER' | null;
  home_sp_name: string | null;
  away_sp_name: string | null;
  projection_label: string | null;
  is_final_prediction?: boolean | null;
  home_sp_confirmed?: boolean | null;
  away_sp_confirmed?: boolean | null;
  weather_confirmed?: boolean | null;
  weather_imputed?: boolean | null;
  odds_available?: boolean | null;
  prediction_available?: boolean | null;
  starters_available?: boolean | null;
  within_lockout_window?: boolean | null;
  f5_fair_total?: number | null;
  f5_pred_margin?: number | null;
  f5_total_line?: number | null;
  f5_home_spread?: number | null;
  f5_away_spread?: number | null;
  f5_ou_edge?: number | null;
  f5_home_win_prob?: number | null;
  f5_away_win_prob?: number | null;
  f5_home_ml_edge_pct?: number | null;
  f5_away_ml_edge_pct?: number | null;
  f5_home_ml_strong_signal?: boolean | null;
  f5_away_ml_strong_signal?: boolean | null;
  ou_fair_total?: number | null;
  home_ml_strong_signal?: boolean | null;
  away_ml_strong_signal?: boolean | null;
  ou_strong_signal?: boolean | null;
  ou_moderate_signal?: boolean | null;
  [key: string]: unknown;
}

export type MLBTeamMapping = MlbTeamMappingRow;

/** Row from `mlb_game_signals` — arrays are JSON in DB; normalized at render. */
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

/** Same neutral pair the legacy page passed to NFLGameCard for both MLB teams. */
export const mlbFallbackTeamColors = { primary: '#1f2937', secondary: '#6b7280' };

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

export function formatMlbGameTime(timeString: string | null): string {
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

function toNum(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number(value);
}

export function isF5MlStrongSignal(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

export function getConfidenceTier(pred: MLBPredictionRow): 'full' | 'high' | 'medium' | 'low' {
  if (pred.is_final_prediction && pred.home_sp_confirmed && pred.away_sp_confirmed && pred.weather_confirmed) return 'full';
  if (pred.home_sp_confirmed && pred.away_sp_confirmed) return 'high';
  if (pred.home_sp_confirmed || pred.away_sp_confirmed) return 'medium';
  return 'low';
}

export function getFullGameRuns(pred: MLBPredictionRow): { home: number; away: number; margin: number } | null {
  const p = toNum(pred.ml_home_win_prob);
  const total = toNum(pred.ou_fair_total);
  if (p === null || total === null || p <= 0 || p >= 1) return null;

  const exp = 1.83;
  const ratio = Math.pow(p / (1 - p), 1 / exp);
  const home = total * ratio / (ratio + 1);
  const away = total / (ratio + 1);
  return { home, away, margin: home - away };
}

export function getF5Runs(pred: MLBPredictionRow): { home: number; away: number } | null {
  const total = toNum(pred.f5_fair_total);
  const margin = toNum(pred.f5_pred_margin);
  if (total === null || margin === null) return null;
  return {
    home: (total + margin) / 2,
    away: (total - margin) / 2,
  };
}

/** Stable map key so string/number/bigint `game_pk` from PostgREST all match. */
export function gamePkMapKey(pk: unknown): string | null {
  if (pk === null || pk === undefined) return null;
  if (typeof pk === 'bigint') return pk.toString();
  const n = Number(pk);
  if (!Number.isNaN(n) && Number.isFinite(n)) return String(Math.trunc(n));
  const s = String(pk).trim();
  return s.length ? s : null;
}

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

export function signalsRowForGamePk(
  map: Map<string, MLBGameSignalsRow>,
  gamePk: number | string | null | undefined,
): MLBGameSignalsRow | undefined {
  const key = gamePkMapKey(gamePk);
  if (!key) return undefined;
  return map.get(key);
}

/** Game-level first, then home, then away (per product spec). */
export function combineSignalsOrdered(row: MLBGameSignalsRow | undefined): MLBSignalItem[] {
  if (!row) return [];
  return [
    ...parseSignalArray(row.game_signals),
    ...parseSignalArray(row.home_signals),
    ...parseSignalArray(row.away_signals),
  ];
}

export async function fetchMlbGames(): Promise<SportFeed<MLBPredictionRow>> {
  // Step 1: today's slate
  const { data: games, error: gamesError } = await collegeFootballSupabase
    .from('mlb_games_today')
    .select('*')
    .order('official_date', { ascending: true })
    .order('game_time_et', { ascending: true });

  if (gamesError) {
    throw new Error(gamesError.message);
  }

  // Step 2: team mappings (abbrev + logo resolution, reused by detail sections)
  const { data: teams, error: teamError } = await collegeFootballSupabase
    .from('mlb_team_mapping')
    .select('*');

  if (teamError) {
    throw new Error(teamError.message);
  }

  const { byMlbApiId, byTeamName, list: mappingList } = buildMlbTeamMappingMaps(
    (teams || []) as Record<string, unknown>[],
  );

  // Step 3: mlb_predictions_current overrides (final-prediction flag + F5 ML edges)
  const gamePks = (games || []).map((g: any) => Number(g.game_pk)).filter((n: number) => !Number.isNaN(n));
  const currentByGamePk = new Map<number, Record<string, unknown>>();
  if (gamePks.length > 0) {
    const { data: currentRows } = await collegeFootballSupabase
      .from('mlb_predictions_current')
      .select('game_pk,is_final_prediction,f5_home_ml_edge_pct,f5_away_ml_edge_pct')
      .in('game_pk', gamePks);
    (currentRows || []).forEach((row: any) => {
      const pk = Number(row.game_pk);
      if (!Number.isNaN(pk)) {
        currentByGamePk.set(pk, row as Record<string, unknown>);
      }
    });
  }

  const mergedGames = (games || []).map((g: any) => {
    const pk = Number(g.game_pk);
    const cur = !Number.isNaN(pk) ? currentByGamePk.get(pk) : undefined;
    return {
      ...g,
      is_final_prediction:
        cur !== undefined ? !!cur.is_final_prediction : (g.is_final_prediction ?? null),
      ...(cur !== undefined
        ? {
            f5_home_ml_edge_pct: (cur.f5_home_ml_edge_pct ?? null) as number | null,
            f5_away_ml_edge_pct: (cur.f5_away_ml_edge_pct ?? null) as number | null,
          }
        : {}),
    };
  }) as MLBPredictionRow[];

  // Step 4: betting signals. Fetch all rows from the view (already scoped
  // server-side). Do not `.in(game_pk)` here: signal rows must still join
  // when `game_pk` serialization matches cards.
  const { data: signalRows, error: signalsError } = await collegeFootballSupabase
    .from('mlb_game_signals')
    .select('game_pk, home_signals, away_signals, game_signals');

  const signalsByGamePk = new Map<string, MLBGameSignalsRow>();
  if (signalsError) {
    debug.warn('[MLB] mlb_game_signals:', signalsError.message);
  } else {
    (signalRows || []).forEach((r: any) => {
      const key = gamePkMapKey(r.game_pk);
      if (!key) return;
      const pkNum = Number(r.game_pk);
      signalsByGamePk.set(key, {
        game_pk: Number.isNaN(pkNum) ? 0 : pkNum,
        home_signals: r.home_signals,
        away_signals: r.away_signals,
        game_signals: r.game_signals,
      });
    });
  }

  // Team resolution: name → id → fuzzy name → hardcoded fallbacks (page order)
  const teamRef = (teamId: number | null, teamName: string): TeamRef => {
    const resolved = resolveMlbTeamDisplay(teamId, teamName, byMlbApiId, byTeamName, mappingList);
    const abbrev = resolved?.abbrev ?? fallbackAbbrevFromTeamName(teamName);
    const logoUrl =
      resolved?.logoUrl ??
      supplementalMlbLogoUrl(normalizeTeamNameKey(teamName), abbrev) ??
      null;
    return {
      name: teamName,
      abbrev,
      logoUrl,
      colors: getMLBTeamColors(abbrev),
    };
  };

  const feedGames: GameFeedItem<MLBPredictionRow>[] = mergedGames.map((row) => {
    const rowAny = row as Record<string, any>;
    const awayTeam = rowAny.away_team_name ?? rowAny.away_team ?? rowAny.away_team_full_name ?? 'Away Team';
    const homeTeam = rowAny.home_team_name ?? rowAny.home_team ?? rowAny.home_team_full_name ?? 'Home Team';
    const awayTeamId = Number(rowAny.away_team_id ?? rowAny.away_mlb_team_id ?? rowAny.away_id ?? NaN);
    const homeTeamId = Number(rowAny.home_team_id ?? rowAny.home_mlb_team_id ?? rowAny.home_id ?? NaN);
    const gameKey = String(row.game_pk ?? row.id ?? `${awayTeam}-${homeTeam}-${row.official_date}`);

    return {
      sport: 'mlb',
      id: gameKey,
      awayTeam: teamRef(Number.isNaN(awayTeamId) ? null : awayTeamId, awayTeam),
      homeTeam: teamRef(Number.isNaN(homeTeamId) ? null : homeTeamId, homeTeam),
      gameDate: row.official_date || '',
      gameTimeLabel: formatMlbGameTime(row.game_time_et),
      timeSortKey: row.game_time_et || '',
      status: row.is_postponed === true ? 'postponed' : 'scheduled',
      lines: {
        homeML: row.home_ml ?? null,
        awayML: row.away_ml ?? null,
        homeSpread: row.home_spread ?? null,
        awaySpread: row.away_spread ?? null,
        total: row.total_line ?? null,
      },
      edges: {
        spreadEdge: null,
        totalEdge: row.ou_edge ?? null,
        mlProb: row.ml_home_win_prob ?? null,
      },
      raw: row,
    };
  });

  return {
    games: feedGames,
    extras: {
      teamMapByMlbApiId: byMlbApiId,
      teamMapByTeamName: byTeamName,
      teamMappingsList: mappingList,
      signalsByGamePk,
    },
    fetchedAt: Date.now(),
  };
}
