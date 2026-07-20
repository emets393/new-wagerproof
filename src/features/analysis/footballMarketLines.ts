/**
 * Cross-market line filters for NFL/CFB historical analysis.
 * Lines apply to the sample regardless of which result market (betType) is selected.
 */

export type SpreadSide = 'any' | 'favorite' | 'underdog';

export type SpreadLineCfg = {
  max: number;
  mk: string;
  xk: string;
  amk: string;
  axk: string;
};

export type TotalLineCfg = {
  min: number;
  max: number;
  mk: string;
  xk: string;
  label: string;
};

/** Full-game spread (subject team row). */
export const FG_SPREAD_NFL: SpreadLineCfg = {
  max: 20, mk: 'spread_min', xk: 'spread_max', amk: 'abs_spread_min', axk: 'abs_spread_max',
};
export const FG_SPREAD_CFB: SpreadLineCfg = {
  max: 50, mk: 'spread_min', xk: 'spread_max', amk: 'abs_spread_min', axk: 'abs_spread_max',
};

export const H1_SPREAD_NFL: SpreadLineCfg = {
  max: 14, mk: 'h1_spread_min', xk: 'h1_spread_max', amk: 'h1_abs_spread_min', axk: 'h1_abs_spread_max',
};
export const H1_SPREAD_CFB: SpreadLineCfg = {
  max: 28, mk: 'h1_spread_min', xk: 'h1_spread_max', amk: 'h1_abs_spread_min', axk: 'h1_abs_spread_max',
};

export const FG_TOTAL_NFL: TotalLineCfg = { min: 30, max: 60, mk: 'total_min', xk: 'total_max', label: 'Game total' };
export const FG_TOTAL_CFB: TotalLineCfg = { min: 30, max: 80, mk: 'total_min', xk: 'total_max', label: 'Game total' };
export const H1_TOTAL_NFL: TotalLineCfg = { min: 15, max: 35, mk: 'h1_total_min', xk: 'h1_total_max', label: '1H total' };
export const H1_TOTAL_CFB: TotalLineCfg = { min: 15, max: 45, mk: 'h1_total_min', xk: 'h1_total_max', label: '1H total' };
export const TT_LINE_NFL: TotalLineCfg = { min: 10, max: 40, mk: 'tt_min', xk: 'tt_max', label: 'Team total line' };
export const TT_LINE_CFB: TotalLineCfg = { min: 10, max: 55, mk: 'tt_min', xk: 'tt_max', label: 'Team total line' };

/** Opponent spread on the subject row is the negation of the subject team's spread. */
export function invertSpreadSide(side: SpreadSide): SpreadSide {
  if (side === 'favorite') return 'underdog';
  if (side === 'underdog') return 'favorite';
  return 'any';
}

/** Emit signed / abs spread predicates for one market. */
export function emitSpreadLine(
  f: Record<string, unknown>,
  side: SpreadSide,
  size: [number, number],
  cfg: SpreadLineCfg,
  opts?: { invert?: boolean },
): void {
  const effective = opts?.invert ? invertSpreadSide(side) : side;
  const [lo, hi] = size;
  const loD = Math.max(lo, 0.5);
  if (effective === 'favorite') {
    f[cfg.mk] = -hi;
    f[cfg.xk] = -loD;
  } else if (effective === 'underdog') {
    f[cfg.mk] = loD;
    f[cfg.xk] = hi;
  } else if (lo > 0 || hi < cfg.max) {
    f[cfg.amk] = lo;
    f[cfg.axk] = hi;
  }
}

export function emitTotalLine(
  f: Record<string, unknown>,
  range: [number, number],
  cfg: TotalLineCfg,
): void {
  if (range[0] > cfg.min) f[cfg.mk] = range[0];
  if (range[1] < cfg.max) f[cfg.xk] = range[1];
}

/** American-odds bounds; forgives reversed entry. */
export function emitMlOdds(
  f: Record<string, unknown>,
  minStr: string,
  maxStr: string,
  keys: { min: string; max: string } = { min: 'ml_min', max: 'ml_max' },
): void {
  let a = minStr.trim() === '' ? null : Number(minStr);
  let b = maxStr.trim() === '' ? null : Number(maxStr);
  if (a !== null && b !== null && a > b) {
    const s = a;
    a = b;
    b = s;
  }
  if (a !== null && !Number.isNaN(a)) f[keys.min] = a;
  if (b !== null && !Number.isNaN(b)) f[keys.max] = b;
}

export function emitWindRange(
  f: Record<string, unknown>,
  range: [number, number],
  maxDefault = 60,
): void {
  if (range[0] > 0) f.wind_min = range[0];
  if (range[1] < maxDefault) f.wind_max = range[1];
}

export function windLabel(range: [number, number], maxDefault = 60): string | null {
  if (range[0] === 0 && range[1] === maxDefault) return null;
  if (range[0] > 0 && range[1] < maxDefault) return `Wind ${range[0]}–${range[1]} mph`;
  if (range[0] > 0) return `Wind ≥ ${range[0]} mph`;
  return `Wind ≤ ${range[1]} mph`;
}
