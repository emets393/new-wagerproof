/** Spotlight record. Units are already settled; this only adds them up. */

export interface LedgerRow {
  season: number;
  week: number;
  player_name: string;
  market_label: string;
  side: string;
  line: number | null;
  price: number | null;
  book_name: string | null;
  result: string | null;
  actual_value: number | null;
  units: number | null;
  board_rank: number | null;
}

export interface MarketRecord {
  label: string;
  wins: number;
  losses: number;
  pushes: number;
  units: number;
  graded: number;
  roi: number | null;
}

export interface LedgerSummary {
  wins: number;
  losses: number;
  pushes: number;
  graded: number;
  pending: number;
  units: number;
  roi: number | null;
  winRate: number | null;
  markets: MarketRecord[];
}

function resultOf(row: LedgerRow): 'win' | 'loss' | 'push' | null {
  const value = (row.result ?? '').toLowerCase();
  if (value === 'win' || value === 'loss' || value === 'push') return value;
  return row.result == null ? null : null;
}

export function summarizeLedger(rows: LedgerRow[]): LedgerSummary {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let units = 0;
  let pending = 0;
  const byLabel = new Map<string, { wins: number; losses: number; pushes: number; units: number; graded: number }>();
  for (const row of rows) {
    const result = resultOf(row);
    if (!result) {
      pending += 1;
      continue;
    }
    if (result === 'win') wins += 1;
    else if (result === 'loss') losses += 1;
    else pushes += 1;
    if (typeof row.units === 'number') units += row.units;
    const bucket = byLabel.get(row.market_label) ?? { wins: 0, losses: 0, pushes: 0, units: 0, graded: 0 };
    bucket.graded += 1;
    if (result === 'win') bucket.wins += 1;
    else if (result === 'loss') bucket.losses += 1;
    else bucket.pushes += 1;
    if (typeof row.units === 'number') bucket.units += row.units;
    byLabel.set(row.market_label, bucket);
  }
  const graded = wins + losses + pushes;
  const decided = wins + losses;
  const markets = [...byLabel.entries()]
    .map(([label, bucket]) => ({
      label,
      wins: bucket.wins,
      losses: bucket.losses,
      pushes: bucket.pushes,
      units: bucket.units,
      graded: bucket.graded,
      roi: bucket.graded > 0 ? bucket.units / bucket.graded : null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return {
    wins,
    losses,
    pushes,
    graded,
    pending,
    units,
    roi: graded > 0 ? units / graded : null,
    winRate: decided > 0 ? wins / decided : null,
    markets,
  };
}

/** Graded picks, newest week first, then board order within that week. */
export function gradedHistory(rows: LedgerRow[]): LedgerRow[] {
  return rows
    .filter((row) => resultOf(row) != null)
    .sort((a, b) => (b.season - a.season) || (b.week - a.week) || ((a.board_rank ?? 99) - (b.board_rank ?? 99)));
}

export const HISTORY_PAGE = 10;

export function formatUnits(units: number | null): string | null {
  if (units == null || !Number.isFinite(units)) return null;
  const body = Math.abs(units).toFixed(2);
  if (units > 0) return `+${body}`;
  if (units < 0) return `\u2212${body}`;
  return '0.00';
}

export function formatRoi(roi: number | null): string | null {
  if (roi == null || !Number.isFinite(roi)) return null;
  const body = Math.abs(roi * 100).toFixed(1);
  if (roi > 0) return `+${body}%`;
  if (roi < 0) return `\u2212${body}%`;
  return '0.0%';
}

export function formatAmerican(price: number | null): string | null {
  if (price == null || !Number.isFinite(price)) return null;
  const body = String(Math.abs(Math.round(price)));
  if (price > 0) return `+${body}`;
  if (price < 0) return `\u2212${body}`;
  return body;
}
