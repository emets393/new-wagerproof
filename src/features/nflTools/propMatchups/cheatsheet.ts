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
  rush_def_RB: 'Run defense',
  rush_def_QB: 'Run defense',
  recv_off: 'Receiving corps',
  recv_def_WR: 'Pass defense',
  recv_def_TE: 'Pass defense',
  recv_def_RB: 'Pass defense',
  recv_def_slot: 'Pass defense',
  recv_def_wide: 'Pass defense',
};

/** One board per family and side. Position and alignment choose which rows it shows. */
export interface CheatSlice {
  value: string;
  label: string;
  tableKey: string;
  kind: 'position' | 'alignment';
}

export interface CheatSheetDef {
  id: string;
  family: string;
  side: string;
  label: string;
  tableKey: string;
  slices: CheatSlice[];
}

export const SHEETS: CheatSheetDef[] = [
  { id: 'pass_off', family: 'passing', side: 'offense', label: 'Passing attack', tableKey: 'pass_off', slices: [] },
  { id: 'pass_def', family: 'passing', side: 'defense', label: 'Pass defense', tableKey: 'pass_def', slices: [] },
  { id: 'rush_off', family: 'rushing', side: 'offense', label: 'Run game', tableKey: 'rush_off', slices: [] },
  {
    id: 'rush_def',
    family: 'rushing',
    side: 'defense',
    label: 'Run defense',
    tableKey: 'rush_def_RB',
    slices: [
      { value: 'RB', label: 'RB', tableKey: 'rush_def_RB', kind: 'position' },
      { value: 'QB', label: 'QB', tableKey: 'rush_def_QB', kind: 'position' },
    ],
  },
  { id: 'recv_off', family: 'receiving', side: 'offense', label: 'Receiving corps', tableKey: 'recv_off', slices: [] },
  {
    id: 'recv_def',
    family: 'receiving',
    side: 'defense',
    label: 'Receiving defense',
    tableKey: 'recv_def_WR',
    slices: [
      { value: 'WR', label: 'WR', tableKey: 'recv_def_WR', kind: 'position' },
      { value: 'TE', label: 'TE', tableKey: 'recv_def_TE', kind: 'position' },
      { value: 'RB', label: 'RB', tableKey: 'recv_def_RB', kind: 'position' },
      { value: 'slot', label: 'Slot', tableKey: 'recv_def_slot', kind: 'alignment' },
      { value: 'wide', label: 'Wide', tableKey: 'recv_def_wide', kind: 'alignment' },
    ],
  },
];

export function defaultSlice(sheet: CheatSheetDef): string | null {
  return sheet.slices[0]?.value ?? null;
}

export function sheetTableKey(sheet: CheatSheetDef, slice: string | null): string {
  if (!slice) return sheet.tableKey;
  return sheet.slices.find((item) => item.value === slice)?.tableKey ?? sheet.tableKey;
}

export function rowsForSheet(rows: CheatRow[], sheet: CheatSheetDef, slice: string | null): CheatRow[] {
  const tableKey = sheetTableKey(sheet, slice);
  return rows.filter((row) => row.tableKey === tableKey);
}

const ALIGNMENTS = [
  { value: 'slot', label: 'Slot', tableKey: 'recv_def_slot' },
  { value: 'wide', label: 'Wide', tableKey: 'recv_def_wide' },
] as const;

export interface ActiveCheat {
  kind: 'trenches' | 'metrics';
  tableKey: string | null;
  title: string;
  description: string;
  showSide: boolean;
  positions: { value: string; label: string }[];
  alignments: { value: string; label: string }[];
}

const VIEW_COPY: Record<string, { title: string; description: string }> = {
  pass_off: {
    title: 'Passing attack',
    description: 'This team’s own passing game. The player is their starting quarterback. Every number is the offense against the league.',
  },
  pass_def: {
    title: 'Pass defense',
    description: 'How this defense defends the pass. The player is the opponent’s starting quarterback. Every number is the defense against the league.',
  },
  rush_off: {
    title: 'Run game',
    description: 'This team’s own run game. The player is their lead back. Every number is the offense against the league.',
  },
  rush_def_RB: {
    title: 'Run defense',
    description: 'Run defense against running backs. The player is the opponent’s lead back. Every number is the defense against the league.',
  },
  rush_def_QB: {
    title: 'Run defense',
    description: 'Run defense against quarterback runs. The player is the opponent’s starting quarterback. Every number is the defense against the league.',
  },
  recv_off: {
    title: 'Receiving corps',
    description: 'This team’s own receiving game. The player is their WR1 by target share. Every number is the offense against the league.',
  },
  recv_def_WR: {
    title: 'Receiving defense',
    description: 'Pass defense against wide receivers. The player is the opponent’s WR1. Every number is the defense against the league.',
  },
  recv_def_TE: {
    title: 'Receiving defense',
    description: 'Pass defense against tight ends. The player is the opponent’s TE1. Every number is the defense against the league.',
  },
  recv_def_RB: {
    title: 'Receiving defense',
    description: 'Pass defense against backs out of the backfield. The player is the opponent’s pass-catching back. Every number is the defense against the league.',
  },
  recv_def_slot: {
    title: 'Receiving defense',
    description: 'Pass defense against slot routes. The player is whoever runs the most slot routes for the opponent. Every number is the defense against the league.',
  },
  recv_def_wide: {
    title: 'Receiving defense',
    description: 'Pass defense against outside routes. The player is whoever runs the most wide routes for the opponent. Every number is the defense against the league.',
  },
};

/** One filter combination, one table. Alignment only exists on receiving, and it replaces the position cut. */
export function activeCheat(selection: { family: string; side: string; position: string; alignment: string }): ActiveCheat {
  if (selection.family === 'trenches') {
    return {
      kind: 'trenches',
      tableKey: null,
      title: 'Trenches',
      description: 'One offensive line against the front it faces this week. Positive means the line has the edge. Pass is pressure. Run is yards before contact.',
      showSide: false,
      positions: [],
      alignments: [],
    };
  }
  const alignments = selection.family === 'receiving' ? ALIGNMENTS.map((item) => ({ value: item.value, label: item.label })) : [];
  const align = selection.family === 'receiving' ? ALIGNMENTS.find((item) => item.value === selection.alignment) : undefined;
  if (align) {
    const copy = VIEW_COPY[align.tableKey];
    return {
      kind: 'metrics',
      tableKey: align.tableKey,
      title: copy.title,
      description: copy.description,
      showSide: true,
      positions: [],
      alignments,
    };
  }
  const sheet = SHEETS.find((item) => item.family === selection.family && item.side === selection.side)
    ?? SHEETS.find((item) => item.family === selection.family)!;
  const positions = sheet.slices.filter((item) => item.kind === 'position').map((item) => ({ value: item.value, label: item.label }));
  const position = positions.find((item) => item.value === selection.position) ?? positions[0];
  const tableKey = position
    ? sheet.slices.find((item) => item.value === position.value)?.tableKey ?? sheet.tableKey
    : sheet.tableKey;
  const copy = VIEW_COPY[tableKey] ?? { title: sheet.label, description: 'This team against the league.' };
  return {
    kind: 'metrics',
    tableKey,
    title: copy.title,
    description: copy.description,
    showSide: true,
    positions,
    alignments,
  };
}

export const METRIC_HELP: Record<string, string> = {
  cpoe: 'Completion percentage over expected, versus the league rate.',
  sack_rate: 'Share of dropbacks that end in a sack.',
  pressure_oe: 'Pressure over expected, in percentage points versus the league.',
  off_target_rate: 'Share of throws that miss the target.',
  deep_rate: 'Share of throws that travel deep.',
  explosive_rate: 'Share of plays that gain an explosive chunk.',
  success_rate: 'Share of plays that count as a success for the offense.',
  td_rate: 'Share of plays that score a touchdown.',
  stuff_rate: 'Share of runs stopped at or behind the line.',
  mtf_per_att: 'Missed tackles forced per rush attempt.',
  yac_per_att: 'Yards after the catch per reception.',
  yoe_per_target: 'Receiving yards over expected per target.',
  targets_per_route: 'Targets earned per route run.',
  catch_rate: 'Share of targets that are caught.',
  target_catchable_rate: 'Share of targets the receiver can catch.',
  first_read_rate: 'Share of targets that are the quarterback’s first read.',
  checkdown_rate: 'Share of dropbacks thrown as a checkdown.',
  man_share: 'Share of coverage snaps played in man.',
  zone_share: 'Share of coverage snaps played in zone.',
  man_success: 'Success rate when the defense is in man.',
  zone_success: 'Success rate when the defense is in zone.',
  slot_share: 'Share of routes run from the slot.',
  wide_share: 'Share of routes run outside.',
  inline_share: 'Share of routes run inline.',
  backfield_share: 'Share of targets that come from the backfield.',
};

export function metricHelp(key: string): string {
  return METRIC_HELP[key] ?? 'This team against the league at the same denominator.';
}

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

/**
 * Whether a higher raw value helps an offense. Defense rows store what that defense allows,
 * so the offense's good is the defense's bad. `neutral` is a mix (share, depth) with no edge.
 * Rank in the database is 1 = highest value, not 1 = best for the team on the row.
 */
type RowPolarity = 'high' | 'low' | 'neutral';

const OFFENSE_POLARITY: Record<string, RowPolarity> = {
  success_rate: 'high',
  stuff_rate: 'low',
  yac_per_att: 'high',
  mtf_per_att: 'high',
  explosive_rate: 'high',
  td_rate: 'high',
  zone_success: 'high',
  man_success: 'high',
  zone_share: 'neutral',
  man_share: 'neutral',
  cpoe: 'high',
  pressure_oe: 'low',
  sack_rate: 'low',
  off_target_rate: 'low',
  deep_rate: 'neutral',
  checkdown_rate: 'neutral',
  yoe_per_target: 'high',
  targets_per_route: 'high',
  catch_rate: 'high',
  target_catchable_rate: 'high',
  first_read_rate: 'neutral',
  slot_share: 'neutral',
  wide_share: 'neutral',
  inline_share: 'neutral',
  backfield_share: 'neutral',
};

export function rowPolarity(side: string, key: string): RowPolarity {
  const offense = OFFENSE_POLARITY[key] ?? 'neutral';
  if (offense === 'neutral') return 'neutral';
  if (side === 'defense') return offense === 'high' ? 'low' : 'high';
  return offense;
}

export function metricDirection(side: string, key: string): string {
  const polarity = rowPolarity(side, key);
  const who = side === 'defense' ? 'this defense' : 'this offense';
  if (polarity === 'neutral') return 'This is a mix, not an edge, so it stays grey.';
  if (polarity === 'high') return `Higher favors ${who}. Green means it does. 1st is the best for them.`;
  return `Lower favors ${who}. Green means it does. 1st is the best for them.`;
}

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

/**
 * Grey only a real tie. The old bands (0.5 yards, 0.05 targets, 3 pp) were wider than
 * the gap between most teams, so missed tackles, yards after catch, and targets per route
 * rendered with no color at all.
 */
const DEAD_ABS: Record<string, number> = {
  mtf_per_att: 0.02,
  yac_per_att: 0.15,
  yoe_per_target: 0.25,
  targets_per_route: 0.004,
};

function deadFor(key: string): number {
  if (key in DEAD_ABS) return DEAD_ABS[key];
  const kind = kindOf(key);
  if (kind === 'pp') return 1;
  if (kind === 'yards') return 0.25;
  if (kind === 'decimal') return 0.004;
  return 0.01;
}

function toneFor(side: string, key: string, gap: number): CheatTone {
  const polarity = rowPolarity(side, key);
  if (polarity === 'neutral' || Math.abs(gap) < deadFor(key)) return 'nil';
  const higherHelps = polarity === 'high';
  return higherHelps === gap > 0 ? 'pos' : 'neg';
}

function rawGap(key: string, metric: CheatMetric | null): number | null {
  if (!metric) return null;
  const kind = kindOf(key);
  if (kind === 'pp') {
    if (metric.actual == null || metric.league == null) return null;
    return (metric.actual - metric.league) * 100;
  }
  if (kind === 'yards' || kind === 'decimal') {
    if (metric.actual == null || metric.league == null) return null;
    return metric.actual - metric.league;
  }
  return metric.lift;
}

/** Positive when the gap helps the team the row is about. */
function teamEdge(side: string, key: string, metric: CheatMetric | null): number | null {
  const gap = rawGap(key, metric);
  if (gap == null) return null;
  return rowPolarity(side, key) === 'low' ? -gap : gap;
}

/** The gap a reader should see. Color is for the team on the row, not for a higher number. */
export function formatGap(key: string, metric: CheatMetric, side = 'offense'): { text: string; tone: CheatTone } | null {
  const kind = kindOf(key);
  const gap = rawGap(key, metric);
  if (gap == null) return null;
  if (kind === 'pp') return { text: `${signed(gap, 1)} pp`, tone: toneFor(side, key, gap) };
  if (kind === 'yards' || kind === 'decimal') {
    const unit = measureUnit(key);
    return { text: `${signed(gap, kind === 'yards' ? 2 : 3)}${unit ? ` ${unit}` : ''}`, tone: toneFor(side, key, gap) };
  }
  return { text: `${signed(gap * 100, 1)}%`, tone: toneFor(side, key, gap) };
}

function ordinal(n: number): string {
  const mod = n % 100;
  const suffix = mod >= 11 && mod <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** 1st is the best result for the team on the row. Stored rank 1 is only the highest raw value. */
export function rankLabel(metric: CheatMetric, side = 'offense', key = 'success_rate'): string | null {
  if (metric.rank == null || metric.of == null) return null;
  const stored = Math.round(metric.rank);
  const n = Math.round(metric.of);
  const shown = rowPolarity(side, key) === 'low' ? n - stored + 1 : stored;
  return `${ordinal(shown)} of ${n}`;
}

export interface CheatRow {
  family: string;
  tableKey: string;
  positionFilter: string | null;
  alignmentFilter: string | null;
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
      positionFilter: typeof record.position_filter === 'string' ? record.position_filter : null,
      alignmentFilter: typeof record.alignment_filter === 'string' ? record.alignment_filter : null,
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

export function sortRows<T extends { side?: string; metrics: Record<string, CheatMetric | null> }>(
  rows: T[],
  key: string,
  direction: 'asc' | 'desc',
): T[] {
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = teamEdge(a.side ?? 'offense', key, a.metrics[key] ?? null);
    const bv = teamEdge(b.side ?? 'offense', key, b.metrics[key] ?? null);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * sign;
  });
}
