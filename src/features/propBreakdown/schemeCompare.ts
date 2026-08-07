/**
 * Resolve which scheme layer to render for a market — receiving YPT, QB EPA/db,
 * or RB box. Pure field selection; no client math.
 */

import type {
  NflPropPlayerPage,
  PlayerCoverageSplit,
  PlayerOverallYpt,
  PlayerQbOverall,
  PlayerQbSplit,
  PlayerRushOverall,
  PlayerRushSplit,
  SampleFlag,
} from './types';
import {
  COVERAGE_LABELS,
  RUSH_LOOK_LABELS,
  type CoverageKey,
  type RushLookKey,
} from './marketMap';

export type SchemeCompareMode = 'receiving' | 'qb' | 'rush';

export interface CompareLookRow {
  key: string;
  label: string;
  tip?: string;
  /** Primary display value (ypt / epa_db / ypc). */
  value: number | null;
  /** Unit suffix for display. */
  unit: string;
  /** Served delta vs career overall for the compare metric. */
  delta: number | null;
  /** Threshold for coloring the delta as meaningful. */
  deltaThreshold: number;
  sample?: SampleFlag;
  insufficient?: boolean;
  pctile: number | null;
  /** Secondary line under the value (targets / dropbacks / carries + support stats). */
  detail: string;
  /** Support metrics under the right column (QB). */
  support?: string;
}

export interface SchemeCompareResolved {
  mode: SchemeCompareMode;
  overallLabel: string;
  overallValue: number | null;
  overallUnit: string;
  overallDetail: string;
  overallSupport?: string;
  sample?: SampleFlag;
  lookRows: CompareLookRow[];
  emptyReason: 'none' | 'rookie' | 'thin' | 'missing';
}

function isRushMarket(marketKey: string): boolean {
  return marketKey === 'player_rush_yds' || marketKey === 'player_rush_attempts';
}

function isPassMarket(marketKey: string): boolean {
  return (
    marketKey === 'player_pass_yds' ||
    marketKey === 'player_pass_tds' ||
    marketKey === 'player_pass_attempts' ||
    marketKey === 'player_pass_completions'
  );
}

function isReceivingMarket(marketKey: string): boolean {
  return marketKey === 'player_receptions' || marketKey === 'player_reception_yds';
}

/** Pick layer from scheme.kind + market family. */
export function resolveCompareMode(
  page: NflPropPlayerPage,
  marketKey: string
): SchemeCompareMode | null {
  const kind = page.scheme?.kind;
  if (isRushMarket(marketKey) && (kind === 'rb' || page.scheme?.rush_overall)) return 'rush';
  if (isPassMarket(marketKey) && (kind === 'qb' || page.position === 'QB')) return 'qb';
  if (marketKey === 'player_anytime_td') {
    if (kind === 'qb' || page.position === 'QB') return 'qb';
    if (kind === 'rb' || page.scheme?.rush_overall) return 'rush';
    return 'receiving';
  }
  if (isReceivingMarket(marketKey)) return 'receiving';
  // Fallback: position-native layer when market is odd.
  if (kind === 'qb') return 'qb';
  if (kind === 'rb' && page.scheme?.rush_overall) return 'rush';
  if (page.scheme?.player_overall && 'ypt' in (page.scheme.player_overall as object)) {
    return 'receiving';
  }
  return null;
}

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toFixed(digits).replace(/\.0$/, '');
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Math.round(Number(n) * 100)}%`;
}

function isReceivingOverall(v: unknown): v is PlayerOverallYpt {
  return Boolean(v) && typeof v === 'object' && 'ypt' in (v as object);
}

function isQbOverall(v: unknown): v is PlayerQbOverall {
  return Boolean(v) && typeof v === 'object' && 'epa_db' in (v as object) && 'dropbacks' in (v as object);
}

function isRushOverall(v: unknown): v is PlayerRushOverall {
  return Boolean(v) && typeof v === 'object' && 'ypc' in (v as object) && 'carries' in (v as object);
}

function isReceivingSplit(v: unknown): v is PlayerCoverageSplit {
  return Boolean(v) && typeof v === 'object' && 'targets' in (v as object);
}

function isQbSplit(v: unknown): v is PlayerQbSplit {
  return Boolean(v) && typeof v === 'object' && 'dropbacks' in (v as object);
}

function isRushSplit(v: unknown): v is PlayerRushSplit {
  return Boolean(v) && typeof v === 'object' && 'carries' in (v as object);
}

export function resolveSchemeCompare(
  page: NflPropPlayerPage,
  marketKey: string
): SchemeCompareResolved | null {
  const mode = resolveCompareMode(page, marketKey);
  if (!mode) return null;

  const scheme = page.scheme;
  if (!scheme) {
    return {
      mode,
      overallLabel: 'Career',
      overallValue: null,
      overallUnit: '',
      overallDetail: '',
      lookRows: [],
      emptyReason: page.rookie ? 'rookie' : 'missing',
    };
  }

  if (mode === 'qb') {
    const overall = isQbOverall(scheme.player_overall) ? scheme.player_overall : null;
    const focus = (scheme.look_focus?.length
      ? scheme.look_focus
      : (['zone', 'pressure'] as CoverageKey[])) as CoverageKey[];
    const lookRows: CompareLookRow[] = focus
      .map((key) => {
        const raw = scheme.player_splits?.[key];
        if (!isQbSplit(raw) || raw.insufficient || (raw.dropbacks ?? 0) < 1) return null;
        return {
          key,
          label: COVERAGE_LABELS[key] ?? `vs ${key}`,
          value: raw.epa_db ?? null,
          unit: 'EPA/db',
          delta: raw.delta_epa_db ?? null,
          deltaThreshold: 0.04,
          sample: raw.sample,
          pctile: raw.pctile ?? null,
          detail: `${raw.dropbacks} db`,
          support: `YPA ${fmt(raw.ypa, 1)} · ${fmtPct(raw.comp_pct)} cmp · ${fmtPct(raw.sack_rate)} sack`,
        };
      })
      .filter(Boolean) as CompareLookRow[];

    if (!overall && lookRows.length === 0) {
      return {
        mode,
        overallLabel: 'Career EPA/db',
        overallValue: null,
        overallUnit: 'EPA/db',
        overallDetail: '',
        lookRows: [],
        emptyReason: page.rookie ? 'rookie' : 'missing',
      };
    }

    return {
      mode,
      overallLabel: 'Career EPA/db',
      overallValue: overall?.epa_db ?? null,
      overallUnit: 'EPA/db',
      overallDetail: overall ? `${overall.dropbacks} dropbacks` : '',
      overallSupport: overall
        ? `YPA ${fmt(overall.ypa, 1)} · ${fmtPct(overall.comp_pct)} cmp · ${fmtPct(overall.sack_rate)} sack`
        : undefined,
      sample: overall?.sample,
      lookRows,
      emptyReason: lookRows.length === 0 ? (overall?.sample === 'thin' ? 'thin' : 'missing') : 'none',
    };
  }

  if (mode === 'rush') {
    const overall = isRushOverall(scheme.rush_overall) ? scheme.rush_overall : null;
    const focus = (scheme.rush_look_focus?.length
      ? scheme.rush_look_focus
      : (['neutral'] as RushLookKey[])) as RushLookKey[];
    const lookRows: CompareLookRow[] = focus
      .map((key) => {
        const raw = scheme.rush_splits?.[key];
        if (!isRushSplit(raw) || raw.insufficient || (raw.carries ?? 0) < 1) return null;
        return {
          key,
          label: RUSH_LOOK_LABELS[key] ?? `vs ${key}`,
          value: raw.epa_rush ?? null,
          unit: 'EPA/rush',
          delta: raw.delta_epa_rush ?? null,
          deltaThreshold: 0.04,
          sample: raw.sample,
          pctile: raw.pctile ?? null,
          detail: `${raw.carries} att`,
          support: `YPC ${fmt(raw.ypc, 1)}${
            raw.td_rate != null ? ` · TD ${fmtPct(raw.td_rate)}` : ''
          }`,
        };
      })
      .filter(Boolean) as CompareLookRow[];

    if (!overall && lookRows.length === 0) {
      return {
        mode,
        overallLabel: 'Career EPA/rush',
        overallValue: null,
        overallUnit: 'EPA/rush',
        overallDetail: '',
        lookRows: [],
        emptyReason: page.rookie ? 'rookie' : 'missing',
      };
    }

    return {
      mode,
      overallLabel: 'Career EPA/rush',
      overallValue: overall?.epa_rush ?? null,
      overallUnit: 'EPA/rush',
      overallDetail: overall ? `${overall.carries} att` : '',
      overallSupport: overall
        ? `YPC ${fmt(overall.ypc, 1)}${
            overall.td_rate != null ? ` · TD ${fmtPct(overall.td_rate)}` : ''
          }`
        : undefined,
      sample: overall?.sample,
      lookRows,
      emptyReason: lookRows.length === 0 ? (overall?.sample === 'thin' ? 'thin' : 'missing') : 'none',
    };
  }

  // receiving
  const overall = isReceivingOverall(scheme.player_overall) ? scheme.player_overall : null;
  const focus = (scheme.look_focus?.length
    ? scheme.look_focus
    : (['zone', 'man'] as CoverageKey[])).filter(
    (k) => k === 'zone' || k === 'man' || k === 'two_high' || k === 'one_high'
  ) as CoverageKey[];

  const lookRows: CompareLookRow[] = focus
    .map((key) => {
      const raw = scheme.player_splits?.[key];
      if (!isReceivingSplit(raw) || raw.insufficient || (raw.targets ?? 0) < 1) return null;
      if (raw.ypt == null || Number.isNaN(Number(raw.ypt))) return null;
      return {
        key,
        label: COVERAGE_LABELS[key] ?? `vs ${key}`,
        value: raw.ypt,
        unit: 'ypt',
        delta: raw.delta_ypt ?? null,
        deltaThreshold: 0.35,
        sample: raw.sample,
        pctile: raw.pctile ?? null,
        detail: `${raw.targets} tgt`,
      };
    })
    .filter(Boolean) as CompareLookRow[];

  if (!overall && lookRows.length === 0) {
    return {
      mode,
      overallLabel: 'Career ypt',
      overallValue: null,
      overallUnit: 'ypt',
      overallDetail: '',
      lookRows: [],
      emptyReason: page.rookie ? 'rookie' : 'thin',
    };
  }

  return {
    mode,
    overallLabel: 'Career ypt',
    overallValue: overall?.ypt ?? null,
    overallUnit: 'ypt',
    overallDetail: overall ? `all coverages · ${overall.targets} tgt` : '',
    sample: overall?.sample,
    lookRows,
    emptyReason: lookRows.length === 0 ? 'thin' : 'none',
  };
}

/** Map scheme_game_splits stat keys to market keys. */
export const GAME_SPLIT_STAT_FOR_MARKET: Record<string, string> = {
  player_receptions: 'receptions',
  player_reception_yds: 'rec_yds',
  player_rush_yds: 'rush_yds',
  player_rush_attempts: 'rush_att',
  player_pass_yds: 'pass_yds',
  player_pass_attempts: 'pass_att',
};
