/** Team cheat sheet. Every comparison is this team against the league at the same denominator. */

export const TABLE_ORDER = [
  'pass_off',
  'pass_def',
  'rush_off',
  'rush_def_RB',
  'rush_def_QB',
  'recv_off',
  'recv_def_WR',
  'recv_def_TE',
  'recv_def_RB',
  'recv_def_slot',
  'recv_def_wide',
] as const;

export const TABLE_LABEL: Record<string, string> = {
  pass_off: 'Passing attack',
  pass_def: 'Pass defense',
  rush_off: 'Run game',
  rush_def_RB: 'Run defense vs backs',
  rush_def_QB: 'Run defense vs quarterbacks',
  recv_off: 'Receiving corps',
  recv_def_WR: 'Pass defense vs wide receivers',
  recv_def_TE: 'Pass defense vs tight ends',
  recv_def_RB: 'Pass defense vs backs',
  recv_def_slot: 'Pass defense vs the slot',
  recv_def_wide: 'Pass defense vs outside',
};

/** Columns that mean something on this table. Every row carries the other keys too. */
export const CHEAT_COLUMNS: Record<string, string[]> = {
  pass_off: ['cpoe', 'sack_rate', 'pressure_oe', 'off_target_rate', 'deep_rate', 'explosive_rate', 'success_rate', 'td_rate'],
  pass_def: ['cpoe', 'sack_rate', 'pressure_oe', 'off_target_rate', 'deep_rate', 'explosive_rate', 'success_rate', 'td_rate', 'man_share', 'zone_share'],
  rush_off: ['success_rate', 'stuff_rate', 'mtf_per_att', 'explosive_rate', 'td_rate'],
  rush_def_RB: ['success_rate', 'stuff_rate', 'mtf_per_att', 'explosive_rate', 'td_rate'],
  rush_def_QB: ['success_rate', 'stuff_rate', 'explosive_rate', 'td_rate'],
  recv_off: ['yoe_per_target', 'targets_per_route', 'catch_rate', 'first_read_rate', 'deep_rate', 'yac_per_att', 'explosive_rate', 'td_rate'],
  recv_def_WR: ['yoe_per_target', 'catch_rate', 'target_catchable_rate', 'deep_rate', 'yac_per_att', 'explosive_rate', 'td_rate', 'man_success', 'zone_success'],
  recv_def_TE: ['yoe_per_target', 'catch_rate', 'deep_rate', 'yac_per_att', 'td_rate', 'inline_share', 'man_success', 'zone_success'],
  recv_def_RB: ['yoe_per_target', 'catch_rate', 'checkdown_rate', 'yac_per_att', 'backfield_share', 'td_rate'],
  recv_def_slot: ['yoe_per_target', 'slot_share', 'catch_rate', 'yac_per_att', 'explosive_rate', 'td_rate'],
  recv_def_wide: ['yoe_per_target', 'wide_share', 'catch_rate', 'deep_rate', 'explosive_rate', 'td_rate'],
};

type MetricKind = 'rate' | 'pp' | 'yards' | 'decimal';

const METRIC: Record<string, { label: string; kind: MetricKind }> = {
  cpoe: { label: 'CPOE', kind: 'pp' },
  sack_rate: { label: 'Sack rate', kind: 'rate' },
  pressure_oe: { label: 'Pressure OE', kind: 'pp' },
  off_target_rate: { label: 'Off-target', kind: 'rate' },
  deep_rate: { label: 'Deep rate', kind: 'rate' },
  explosive_rate: { label: 'Explosive', kind: 'rate' },
  success_rate: { label: 'Success', kind: 'rate' },
  td_rate: { label: 'TD rate', kind: 'rate' },
  stuff_rate: { label: 'Stuff rate', kind: 'rate' },
  mtf_per_att: { label: 'Missed tackles', kind: 'yards' },
  yac_per_att: { label: 'YAC', kind: 'yards' },
  yoe_per_target: { label: 'Yards over expected', kind: 'yards' },
  targets_per_route: { label: 'Targets / route', kind: 'decimal' },
  catch_rate: { label: 'Catch rate', kind: 'rate' },
  target_catchable_rate: { label: 'Catchable', kind: 'rate' },
  first_read_rate: { label: 'First read', kind: 'rate' },
  checkdown_rate: { label: 'Checkdown', kind: 'rate' },
  man_share: { label: 'Man', kind: 'rate' },
  zone_share: { label: 'Zone', kind: 'rate' },
  man_success: { label: 'Success vs man', kind: 'rate' },
  zone_success: { label: 'Success vs zone', kind: 'rate' },
  slot_share: { label: 'Slot', kind: 'rate' },
  wide_share: { label: 'Wide', kind: 'rate' },
  inline_share: { label: 'Inline', kind: 'rate' },
  backfield_share: { label: 'Backfield', kind: 'rate' },
};

export interface CheatMetric {
  actual: number | null;
  league: number | null;
  lift: number | null;
  rank: number | null;
  of: number | null;
}

export interface CheatPlayer {
  name: string;
  player_id: string;
  position: string | null;
  share: number | null;
  share_label: string | null;
}

export type CheatTone = 'pos' | 'neg' | 'nil';

export function metricLabel(key: string): string {
  return METRIC[key]?.label ?? key;
}

export function columnsFor(tableKey: string): string[] {
  return CHEAT_COLUMNS[tableKey] ?? [];
}

function kindOf(key: string): MetricKind {
  return METRIC[key]?.kind ?? 'rate';
}

function signed(value: number, digits: number): string {
  const body = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${body}`;
  if (value < 0) return `\u2212${body}`;
  return body;
}

function measureUnit(key: string): string {
  if (key === 'mtf_per_att') return 'per att';
  if (key === 'targets_per_route') return '';
  return 'yds';
}

export function formatActual(key: string, actual: number | null): string {
  if (actual == null) return 'not charted this week';
  const kind = kindOf(key);
  if (kind === 'pp') return `${signed(actual * 100, 1)} pp`;
  if (kind === 'rate') return `${(actual * 100).toFixed(1)}%`;
  if (kind === 'decimal') return actual.toFixed(3);
  const unit = measureUnit(key);
  return unit ? `${actual.toFixed(2)} ${unit}` : actual.toFixed(2);
}

/** The gap a reader should see: yards for per-play measures, percent for rates. */
export function formatGap(key: string, metric: CheatMetric): { text: string; tone: CheatTone } | null {
  const kind = kindOf(key);
  if (kind === 'pp') {
    if (metric.actual == null || metric.league == null) return null;
    const gap = (metric.actual - metric.league) * 100;
    return { text: `${signed(gap, 1)} pp`, tone: Math.abs(gap) < 3 ? 'nil' : gap > 0 ? 'pos' : 'neg' };
  }
  if (kind === 'yards' || kind === 'decimal') {
    if (metric.actual == null || metric.league == null) return null;
    const gap = metric.actual - metric.league;
    const dead = Math.abs(gap) < (kind === 'yards' ? 0.5 : 0.05);
    const unit = measureUnit(key);
    return { text: `${signed(gap, kind === 'yards' ? 2 : 3)}${unit ? ` ${unit}` : ''}`, tone: dead ? 'nil' : gap > 0 ? 'pos' : 'neg' };
  }
  if (metric.lift == null) return null;
  const dead = Math.abs(metric.lift) < 0.03;
  return { text: `${signed(metric.lift * 100, 1)}%`, tone: dead ? 'nil' : metric.lift > 0 ? 'pos' : 'neg' };
}

export function rankLabel(metric: CheatMetric): string | null {
  if (metric.rank == null || metric.of == null) return null;
  const n = Math.round(metric.rank);
  const mod = n % 100;
  const suffix = mod >= 11 && mod <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix} of ${Math.round(metric.of)}`;
}

export interface CheatRow {
  family: string;
  tableKey: string;
  side: string;
  team: string;
  opponent: string;
  kickoff: string | null;
  headline: string | null;
  metrics: Record<string, CheatMetric | null>;
  player: CheatPlayer | null;
}

function finite(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function parseCheatRows(rows: unknown[]): CheatRow[] {
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const record = row as Record<string, unknown>;
    const tableKey = typeof record.table_key === 'string' ? record.table_key : '';
    if (!tableKey) return [];
    const metrics: Record<string, CheatMetric | null> = {};
    const rawMetrics = record.metrics && typeof record.metrics === 'object' ? record.metrics as Record<string, unknown> : {};
    for (const key of columnsFor(tableKey)) {
      const cell = rawMetrics[key];
      if (!cell || typeof cell !== 'object') {
        metrics[key] = null;
        continue;
      }
      const metric = cell as Record<string, unknown>;
      metrics[key] = {
        actual: finite(metric.actual),
        league: finite(metric.league),
        lift: finite(metric.lift),
        rank: finite(metric.rank),
        of: finite(metric.of),
      };
    }
    const rawPlayer = record.player;
    let player: CheatPlayer | null = null;
    if (rawPlayer && typeof rawPlayer === 'object') {
      const body = rawPlayer as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name : '';
      const playerId = typeof body.player_id === 'string' ? body.player_id : '';
      if (name && playerId) {
        player = {
          name,
          player_id: playerId,
          position: typeof body.position === 'string' ? body.position : null,
          share: finite(body.share),
          share_label: typeof body.share_label === 'string' ? body.share_label : null,
        };
      }
    }
    return [{
      family: typeof record.family === 'string' ? record.family : '',
      tableKey,
      side: typeof record.side === 'string' ? record.side : '',
      team: typeof record.team === 'string' ? record.team : '',
      opponent: typeof record.opponent === 'string' ? record.opponent : '',
      kickoff: typeof record.kickoff === 'string' ? record.kickoff : null,
      headline: typeof record.headline === 'string' ? record.headline : null,
      metrics,
      player,
    }];
  });
}

export function sortRows<T extends { metrics: Record<string, CheatMetric | null> }>(
  rows: T[],
  key: string,
  direction: 'asc' | 'desc',
): T[] {
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a.metrics[key]?.lift;
    const bv = b.metrics[key]?.lift;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * sign;
  });
}
