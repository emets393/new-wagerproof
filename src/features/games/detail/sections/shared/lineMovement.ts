/**
 * Shared line-movement model for NFL + CFB game-detail widgets.
 *
 * Series come only from the game-keyed consensus views (`nfl_line_movement` /
 * `cfb_line_movement`). The raw archives (`nfl_historical_odds`,
 * `ncaaf_odds_history`) are keyed by Odds-API event id / city name and must not
 * be read for a card's line — the views do that remap.
 *
 * Opening line is `*_slate_games.fg_*_open`. When a market has no view row, the
 * slate close is shown as an explicitly labelled fallback, never as "current".
 * Moneyline has no column in either view, so it is always slate-close only.
 */

import type { TeamRef } from '../../../types';

export type LineValueFormat = 'signed' | 'unsigned' | 'american';

/** Top-level toggle groups — one per market the user asked for. */
export type LineMarketGroup =
  | 'spread'
  | 'total'
  | 'ml'
  | 'tt'
  | 'h1_spread'
  | 'h1_total'
  | 'h1_ml';

export type LineMarketId =
  | 'spread_away'
  | 'spread_home'
  | 'total'
  | 'ml_away'
  | 'ml_home'
  | 'tt_away'
  | 'tt_home'
  | 'h1_spread_away'
  | 'h1_spread_home'
  | 'h1_total'
  | 'h1_ml_away'
  | 'h1_ml_home';

/** One consensus (or single-book) point on the timeline. */
export interface LineHistoryPoint {
  as_of_ts: string;
  value: number | null;
}

export interface LineMarket {
  id: LineMarketId;
  group: LineMarketGroup;
  /** Short label for the within-group toggle ("SEA", "Total", "1H ML"). */
  shortLabel: string;
  /** Full attribution for headline / tooltip ("SEA spread", "Game total"). */
  label: string;
  format: LineValueFormat;
  color: string;
  /** True layer-1 opening value for MoveSummary (or earliest raw snap for ML). */
  open: number | null;
  /** Value from the latest snapshot. */
  current: number | null;
  /**
   * History ordered ascending. Chart only when this has ≥2 distinct non-null
   * values; otherwise the widget shows Open→Now + an honest note.
   */
  history: LineHistoryPoint[];
  /** Sportsbooks represented in the latest consensus snapshot (null for ML). */
  latestBookCount?: number | null;
  /** Optional team for logo marks on the side toggle. */
  team?: TeamRef;
  /** Optional public/sharp splits caption from the slate row. */
  splitsLabel?: string | null;
  /** True when this market has never been posted for the game. */
  notPosted?: boolean;
  /** Header over the right-hand value — "Now" for live view rows, else the fallback's name. */
  currentLabel?: string;
  /** Why this market has no series, when that isn't simply "not posted". */
  seriesNote?: string | null;
}

export const LINE_GROUP_LABELS: Record<LineMarketGroup, string> = {
  spread: 'Spread',
  total: 'Total',
  ml: 'ML',
  tt: 'Team Tot',
  h1_spread: '1H Spread',
  h1_total: '1H Total',
  h1_ml: '1H ML',
};

/** Emerald matches the OVER color used on totals elsewhere in the stack. */
export const TOTAL_LINE_COLOR = '#10b981';

export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatAmericanOdds(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  const n = Math.round(Number(value));
  return n > 0 ? `+${n}` : String(n);
}

export function formatLineValue(
  value: number | null | undefined,
  format: LineValueFormat,
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  if (format === 'american') return formatAmericanOdds(value);
  if (format === 'unsigned') return Number(value).toFixed(1);
  const n = Number(value);
  const body = Number.isInteger(n) ? String(Math.abs(n)) : Math.abs(n).toFixed(1);
  return `${n < 0 ? '-' : '+'}${body}`;
}

/** Distinct non-null numeric values in a series (for chart-vs-summary gate). */
export function distinctSeriesValues(history: LineHistoryPoint[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const p of history) {
    if (p.value === null) continue;
    if (seen.has(p.value)) continue;
    seen.add(p.value);
    out.push(p.value);
  }
  return out;
}

export function canChartMarket(market: LineMarket): boolean {
  return distinctSeriesValues(market.history).length >= 2;
}

/**
 * Scalars from `*_slate_games`. Only `*_open` values are true openers; the slate
 * close is a stale model reference and must never be presented as the live line.
 * The slate only carries openers for FG spread and FG total.
 */
export interface LineScalarBundle {
  spreadOpen?: number | null;
  totalOpen?: number | null;
  spreadClose?: number | null;
  totalClose?: number | null;
  mlHomeClose?: number | null;
  mlHomeOpen?: number | null;
  mlAwayOpen?: number | null;
  mlAwayClose?: number | null;
  ttHomeClose?: number | null;
  ttAwayClose?: number | null;
  h1SpreadClose?: number | null;
  h1TotalClose?: number | null;
  h1MlHomeClose?: number | null;
  h1MlHomeOpen?: number | null;
  h1MlAwayOpen?: number | null;
  h1MlAwayClose?: number | null;
  spreadSplitsLabel?: string | null;
  totalSplitsLabel?: string | null;
}

/**
 * One row from a game-keyed movement view. `nfl_line_movement` carries every
 * column; `cfb_line_movement` only FG spread/total (the rest stay null).
 * Neither view exposes moneyline.
 */
export interface LineConsensusSnap {
  snap_ts: string;
  n_books: number | null;
  fg_spread_home: number | null;
  fg_total: number | null;
  tt_home: number | null;
  tt_away: number | null;
  h1_spread_home: number | null;
  h1_total: number | null;
}

type SeriesKey =
  | 'fg_spread_home'
  | 'fg_total'
  | 'tt_home'
  | 'tt_away'
  | 'h1_spread_home'
  | 'h1_total';

/** Shown when a market's only value is the stale slate reference. */
export const SLATE_CLOSE_LABEL = 'Slate close';

const ML_SERIES_NOTE =
  'Moneyline consensus from the live capture; open is the slate opener.';

interface MarketDef {
  id: LineMarketId;
  group: LineMarketGroup;
  /** Column on the movement view. Absent for moneyline, which has no series. */
  seriesKey?: SeriesKey;
  format: LineValueFormat;
  shortLabel: (away: TeamRef, home: TeamRef) => string;
  label: (away: TeamRef, home: TeamRef) => string;
  color: (away: TeamRef, home: TeamRef) => string;
  team?: (away: TeamRef, home: TeamRef) => TeamRef;
  /** True opener from `*_slate_games.fg_*_open`. */
  scalarOpen?: (s: LineScalarBundle) => number | null;
  /** Slate close, used only as an explicitly labelled fallback. */
  scalarClose?: (s: LineScalarBundle) => number | null;
  splits?: (s: LineScalarBundle) => string | null | undefined;
  /** Negate home-spread series for the away side. */
  negate?: boolean;
  seriesNote?: string;
}

const MARKET_DEFS: MarketDef[] = [
  {
    id: 'spread_away',
    group: 'spread',
    seriesKey: 'fg_spread_home',
    format: 'signed',
    shortLabel: (a) => a.abbrev,
    label: (a) => `${a.abbrev} spread`,
    color: (a) => a.colors.primary,
    team: (a) => a,
    negate: true,
    scalarOpen: (s) => {
      const home = toNum(s.spreadOpen);
      return home !== null ? -home : null;
    },
    scalarClose: (s) => {
      const home = toNum(s.spreadClose);
      return home !== null ? -home : null;
    },
    splits: (s) => s.spreadSplitsLabel,
  },
  {
    id: 'spread_home',
    group: 'spread',
    seriesKey: 'fg_spread_home',
    format: 'signed',
    shortLabel: (_a, h) => h.abbrev,
    label: (_a, h) => `${h.abbrev} spread`,
    color: (_a, h) => h.colors.primary,
    team: (_a, h) => h,
    scalarOpen: (s) => toNum(s.spreadOpen),
    scalarClose: (s) => toNum(s.spreadClose),
    splits: (s) => s.spreadSplitsLabel,
  },
  {
    id: 'total',
    group: 'total',
    seriesKey: 'fg_total',
    format: 'unsigned',
    shortLabel: () => 'O/U',
    label: () => 'Game total',
    color: () => TOTAL_LINE_COLOR,
    scalarOpen: (s) => toNum(s.totalOpen),
    scalarClose: (s) => toNum(s.totalClose),
    splits: (s) => s.totalSplitsLabel,
  },
  {
    id: 'ml_away',
    group: 'ml',
    format: 'american',
    shortLabel: (a) => a.abbrev,
    label: (a) => `${a.abbrev} ML`,
    color: (a) => a.colors.primary,
    team: (a) => a,
    seriesKey: 'ml_away',
    scalarOpen: (s) => toNum(s.mlAwayOpen),
    scalarClose: (s) => toNum(s.mlAwayClose),
  },
  {
    id: 'ml_home',
    group: 'ml',
    format: 'american',
    shortLabel: (_a, h) => h.abbrev,
    label: (_a, h) => `${h.abbrev} ML`,
    color: (_a, h) => h.colors.primary,
    team: (_a, h) => h,
    seriesKey: 'ml_home',
    scalarOpen: (s) => toNum(s.mlHomeOpen),
    scalarClose: (s) => toNum(s.mlHomeClose),
  },
  {
    id: 'tt_away',
    group: 'tt',
    seriesKey: 'tt_away',
    format: 'unsigned',
    shortLabel: (a) => a.abbrev,
    label: (a) => `${a.abbrev} team total`,
    color: (a) => a.colors.primary,
    team: (a) => a,
    scalarClose: (s) => toNum(s.ttAwayClose),
  },
  {
    id: 'tt_home',
    group: 'tt',
    seriesKey: 'tt_home',
    format: 'unsigned',
    shortLabel: (_a, h) => h.abbrev,
    label: (_a, h) => `${h.abbrev} team total`,
    color: (_a, h) => h.colors.primary,
    team: (_a, h) => h,
    scalarClose: (s) => toNum(s.ttHomeClose),
  },
  {
    id: 'h1_spread_away',
    group: 'h1_spread',
    seriesKey: 'h1_spread_home',
    format: 'signed',
    shortLabel: (a) => a.abbrev,
    label: (a) => `${a.abbrev} 1H spread`,
    color: (a) => a.colors.primary,
    team: (a) => a,
    negate: true,
    scalarClose: (s) => {
      const home = toNum(s.h1SpreadClose);
      return home !== null ? -home : null;
    },
  },
  {
    id: 'h1_spread_home',
    group: 'h1_spread',
    seriesKey: 'h1_spread_home',
    format: 'signed',
    shortLabel: (_a, h) => h.abbrev,
    label: (_a, h) => `${h.abbrev} 1H spread`,
    color: (_a, h) => h.colors.primary,
    team: (_a, h) => h,
    scalarClose: (s) => toNum(s.h1SpreadClose),
  },
  {
    id: 'h1_total',
    group: 'h1_total',
    seriesKey: 'h1_total',
    format: 'unsigned',
    shortLabel: () => 'O/U',
    label: () => '1H total',
    color: () => TOTAL_LINE_COLOR,
    scalarClose: (s) => toNum(s.h1TotalClose),
  },
  {
    id: 'h1_ml_away',
    group: 'h1_ml',
    format: 'american',
    shortLabel: (a) => a.abbrev,
    label: (a) => `${a.abbrev} 1H ML`,
    color: (a) => a.colors.primary,
    team: (a) => a,
    seriesKey: 'h1_ml_away',
    scalarOpen: (s) => toNum(s.h1MlAwayOpen),
    scalarClose: (s) => toNum(s.h1MlAwayClose),
  },
  {
    id: 'h1_ml_home',
    group: 'h1_ml',
    format: 'american',
    shortLabel: (_a, h) => h.abbrev,
    label: (_a, h) => `${h.abbrev} 1H ML`,
    color: (_a, h) => h.colors.primary,
    team: (_a, h) => h,
    seriesKey: 'h1_ml_home',
    scalarOpen: (s) => toNum(s.h1MlHomeOpen),
    scalarClose: (s) => toNum(s.h1MlHomeClose),
  },
];

export const GROUP_ORDER: LineMarketGroup[] = [
  'spread',
  'total',
  'ml',
  'tt',
  'h1_spread',
  'h1_total',
  'h1_ml',
];

function readSeriesValue(snap: LineConsensusSnap, def: MarketDef): number | null {
  if (!def.seriesKey) return null;
  const raw = toNum(snap[def.seriesKey]);
  if (raw === null) return null;
  return def.negate ? -raw : raw;
}

/**
 * Build the market list for the widget.
 *
 * Current line is the latest movement-view row. When the view has no value for a
 * market, the slate close stands in but is relabelled so it never reads as live.
 *
 * - `includeEmpty: true` (NFL default) keeps every group visible even when the
 *   books haven't posted that market yet.
 * - `groups` limits which groups are emitted (CFB can omit 1H/TT until posted).
 */
export function buildLineMarkets(args: {
  away: TeamRef;
  home: TeamRef;
  history: LineConsensusSnap[];
  scalars?: LineScalarBundle;
  includeEmpty?: boolean;
  groups?: LineMarketGroup[];
}): LineMarket[] {
  const {
    away,
    home,
    history,
    scalars = {},
    includeEmpty = true,
    groups = GROUP_ORDER,
  } = args;
  const allowed = new Set(groups);
  const markets: LineMarket[] = [];

  for (const def of MARKET_DEFS) {
    if (!allowed.has(def.group)) continue;

    const series: LineHistoryPoint[] = history.map((snap) => ({
      as_of_ts: snap.snap_ts,
      value: readSeriesValue(snap, def),
    }));
    const hasHistoryValue = series.some((p) => p.value !== null);
    const open = def.scalarOpen?.(scalars) ?? null;
    const closeScalar = def.scalarClose?.(scalars) ?? null;
    // Per-series latest: the movement view now interleaves rows from two feeds
    // (FG/book consensus and 1H-ML event odds), so the globally-newest row can be
    // null for this series while older rows carry live values (2026-08-24 incident:
    // the spread tab fell back to "slate close" whenever an h1-ML row was newest).
    let lastIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (readSeriesValue(history[i], def) !== null) {
        lastIdx = i;
        break;
      }
    }
    const liveCurrent = lastIdx >= 0 ? readSeriesValue(history[lastIdx], def) : null;
    // Slate close only stands in when the view has nothing, and is relabelled.
    const current = liveCurrent ?? closeScalar;
    const isLive = liveCurrent !== null;

    if (!hasHistoryValue && open === null && current === null && !includeEmpty) {
      continue;
    }

    const notPosted = !hasHistoryValue && open === null && current === null;

    markets.push({
      id: def.id,
      group: def.group,
      shortLabel: def.shortLabel(away, home),
      label: def.label(away, home),
      format: def.format,
      color: def.color(away, home),
      open,
      current,
      history: hasHistoryValue ? series : [],
      latestBookCount: isLive ? (history[lastIdx]?.n_books ?? null) : null,
      team: def.team?.(away, home),
      splitsLabel: def.splits?.(scalars) ?? null,
      notPosted,
      currentLabel: isLive ? 'Now' : SLATE_CLOSE_LABEL,
      seriesNote: !hasHistoryValue ? (def.seriesNote ?? null) : null,
    });
  }

  return markets;
}

export function groupsPresent(markets: LineMarket[]): LineMarketGroup[] {
  const present = new Set(markets.map((m) => m.group));
  return GROUP_ORDER.filter((g) => present.has(g));
}

/** Postgres `statement_timeout`. */
const STATEMENT_TIMEOUT_CODE = '57014';

/** Backoff between cold-cache retries, in ms. */
const RETRY_DELAYS_MS = [300, 700, 1500, 2500];

interface Postgrestish<T> {
  data: T[] | null;
  error: { code?: string; message?: string } | null;
}

/**
 * Run a movement-view query, retrying while the server reports a statement timeout.
 *
 * The views aggregate a multi-million-row odds archive with no index that
 * supports the game_id lookup, so a cold read reliably blows the statement
 * timeout — measured at four consecutive failures before the pages are cached,
 * after which the same query returns in under 10ms. Retrying through that warm-up
 * is the difference between a chart and an empty card, so keep going a while.
 */
export async function retryOnStatementTimeout<T>(
  run: () => PromiseLike<Postgrestish<T>>,
): Promise<Postgrestish<T>> {
  let result = await run();
  for (const delay of RETRY_DELAYS_MS) {
    if (result.error?.code !== STATEMENT_TIMEOUT_CODE) return result;
    await new Promise((resolve) => setTimeout(resolve, delay));
    result = await run();
  }
  return result;
}

/** True when a fetch failed rather than legitimately returning nothing. */
export function isTimeoutError(error: { code?: string } | null | undefined): boolean {
  return error?.code === STATEMENT_TIMEOUT_CODE;
}

export const LINE_MOVEMENT_TIMEOUT_ERROR =
  'Live line movement timed out while loading. The values below are the slate close.';

/** True when a market's displayed line is the stale slate close, not a live view row. */
export function isSlateCloseFallback(market: LineMarket): boolean {
  return market.current !== null && market.currentLabel === SLATE_CLOSE_LABEL;
}

/**
 * Map a `*_slate_games` row onto the scalar bundle.
 *
 * Openers exist only for FG spread/total; every other market can offer nothing
 * better than its slate close. Shared by NFL and CFB — the column names match.
 */
export function slateScalars(row: Record<string, unknown>): LineScalarBundle {
  return {
    spreadOpen: toNum(row.fg_spread_open),
    totalOpen: toNum(row.fg_total_open),
    spreadClose: toNum(row.fg_spread_close),
    totalClose: toNum(row.fg_total_close),
    mlHomeClose: toNum(row.fg_ml_home_close),
    mlHomeOpen: toNum(row.fg_ml_home_open),
    mlAwayOpen: toNum(row.fg_ml_away_open),
    mlAwayClose: toNum(row.fg_ml_away_close),
    ttHomeClose: toNum(row.tt_home_close),
    ttAwayClose: toNum(row.tt_away_close),
    h1SpreadClose: toNum(row.h1_spread_close),
    h1TotalClose: toNum(row.h1_total_close),
    h1MlHomeClose: toNum(row.h1_ml_home_close),
    h1MlHomeOpen: toNum(row.h1_ml_home_open),
    h1MlAwayOpen: toNum(row.h1_ml_away_open),
    h1MlAwayClose: toNum(row.h1_ml_away_close),
    spreadSplitsLabel: (row.spread_splits_label as string | null) ?? null,
    totalSplitsLabel: (row.total_splits_label as string | null) ?? null,
  };
}
