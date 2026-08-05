/**
 * Locked WHO-HE-IS tile map (CURSOR_PROP_PAGE_STATS_ADDENDUM.md).
 * Resolves served baseline / ngs / scheme fields into headline + expander tiles.
 */

import type { NflPropPlayerPage, MetricPctile, PlayerQbOverall } from './types';
import { formatPerGame, topBadge } from './format';
import { BASELINE_TIPS, NGS_TIPS } from './statTips';
import {
  BASELINE_LABELS,
  NGS_LABELS,
  type BaselineKey,
} from './marketMap';

export type WhoHeIsTile = {
  key: string;
  label: string;
  display: string;
  pctile: number | null;
  /** No badge / no good-bad coloring when true (pctile null or descriptive). */
  descriptive: boolean;
  tip?: string;
};

type TileSpec =
  | { kind: 'baseline'; key: BaselineKey; label?: string; tip?: string }
  | { kind: 'ngs'; key: string; label?: string; tip?: string }
  | { kind: 'comp_pct' };

type TileMap = { headline: TileSpec[]; more: TileSpec[] };

/** Rates served 0–1 that should display as percents. */
const FRACTION_KEYS = new Set([
  'drop_rate',
  'contested_catch',
  'created_rate',
  'rz_tgt_share',
  'rz_carry_share',
  'pa_rate',
  'int_worthy_rate',
]);

/** Values already on a 0–100 percent scale. */
const PERCENT_KEYS = new Set([
  'air_share',
  'catch_pct',
  'eight_box_pct',
  'aggressiveness',
]);

function isMetric(v: unknown): v is MetricPctile {
  return Boolean(v) && typeof v === 'object' && 'v' in (v as object);
}

function isQbOverall(v: unknown): v is PlayerQbOverall {
  return Boolean(v) && typeof v === 'object' && 'comp_pct' in (v as object);
}

function formatNgsValue(key: string, v: number): string {
  if (FRACTION_KEYS.has(key)) return `${formatPerGame(v * 100, 0)}%`;
  if (PERCENT_KEYS.has(key)) return `${formatPerGame(v, key === 'catch_pct' || key === 'air_share' ? 0 : 1)}%`;
  if (key === 'cpoe') {
    const sign = v > 0 ? '+' : '';
    return `${sign}${formatPerGame(v, 2)}`;
  }
  if (key === 'yac_above_exp' || key === 'ryoe_per_att' || key === 'air_yds_to_sticks') {
    const sign = v > 0 ? '+' : '';
    return `${sign}${formatPerGame(v, 2)}`;
  }
  return formatPerGame(v, 2);
}

function resolveMap(page: NflPropPlayerPage, marketKey: string): TileMap {
  const pos = page.position;
  const isRb = pos === 'RB';
  const isQb = pos === 'QB';

  if (marketKey === 'player_receptions') {
    if (isRb) {
      return {
        headline: [
          { kind: 'baseline', key: 'targets' },
          { kind: 'baseline', key: 'receptions' },
          { kind: 'ngs', key: 'rz_tgt_share' },
          { kind: 'baseline', key: 'rec_yds' },
        ],
        more: [],
      };
    }
    return {
      headline: [
        { kind: 'baseline', key: 'targets' },
        { kind: 'baseline', key: 'receptions' },
        { kind: 'ngs', key: 'separation' },
        { kind: 'ngs', key: 'catch_pct' },
      ],
      more: [
        { kind: 'ngs', key: 'cushion' },
        { kind: 'ngs', key: 'drop_rate' },
      ],
    };
  }

  if (marketKey === 'player_reception_yds') {
    if (isRb) {
      return {
        headline: [
          { kind: 'baseline', key: 'targets' },
          { kind: 'baseline', key: 'receptions' },
          { kind: 'ngs', key: 'rz_tgt_share' },
          { kind: 'baseline', key: 'rec_yds' },
        ],
        more: [],
      };
    }
    return {
      headline: [
        { kind: 'baseline', key: 'rec_yds' },
        { kind: 'ngs', key: 'air_share' },
        { kind: 'ngs', key: 'adot' },
        { kind: 'ngs', key: 'yac_above_exp' },
      ],
      more: [
        { kind: 'ngs', key: 'separation' },
        { kind: 'ngs', key: 'contested_catch' },
      ],
    };
  }

  if (marketKey === 'player_rush_yds' || marketKey === 'player_rush_attempts') {
    return {
      headline: [
        { kind: 'baseline', key: 'rush_yds' },
        { kind: 'baseline', key: 'rush_att' },
        { kind: 'ngs', key: 'ryoe_per_att' },
        { kind: 'ngs', key: 'eight_box_pct' },
      ],
      more: [
        { kind: 'ngs', key: 'efficiency' },
        { kind: 'ngs', key: 'time_to_los' },
      ],
    };
  }

  if (marketKey === 'player_anytime_td') {
    if (isRb) {
      return {
        headline: [
          { kind: 'baseline', key: 'total_td', label: 'Season TDs' },
          { kind: 'ngs', key: 'rz_carry_share' },
          { kind: 'ngs', key: 'ryoe_per_att' },
          { kind: 'ngs', key: 'eight_box_pct' },
        ],
        more: [],
      };
    }
    if (isQb) {
      return {
        headline: [
          { kind: 'baseline', key: 'total_td', label: 'Season TDs' },
          { kind: 'baseline', key: 'pass_td' },
          { kind: 'ngs', key: 'cpoe' },
          { kind: 'ngs', key: 'intended_air_yds' },
        ],
        more: [{ kind: 'ngs', key: 'int_worthy_rate' }],
      };
    }
    return {
      headline: [
        { kind: 'baseline', key: 'total_td', label: 'Season TDs' },
        { kind: 'ngs', key: 'air_share' },
        { kind: 'ngs', key: 'contested_catch' },
        { kind: 'ngs', key: 'rz_tgt_share' },
      ],
      more: [{ kind: 'ngs', key: 'created_rate' }],
    };
  }

  if (
    marketKey === 'player_pass_yds' ||
    marketKey === 'player_pass_tds'
  ) {
    return {
      headline: [
        { kind: 'baseline', key: 'pass_yds' },
        { kind: 'baseline', key: 'pass_att' },
        { kind: 'ngs', key: 'cpoe' },
        { kind: 'ngs', key: 'intended_air_yds' },
      ],
      more: [
        { kind: 'ngs', key: 'time_to_throw' },
        { kind: 'ngs', key: 'aggressiveness' },
        { kind: 'ngs', key: 'air_yds_to_sticks' },
        { kind: 'ngs', key: 'int_worthy_rate' },
      ],
    };
  }

  if (
    marketKey === 'player_pass_attempts' ||
    marketKey === 'player_pass_completions'
  ) {
    return {
      headline: [
        { kind: 'baseline', key: 'pass_att' },
        { kind: 'comp_pct' },
        { kind: 'ngs', key: 'time_to_throw' },
        { kind: 'ngs', key: 'intended_air_yds' },
      ],
      more: [{ kind: 'ngs', key: 'pa_rate' }],
    };
  }

  return { headline: [], more: [] };
}

function resolveSpec(page: NflPropPlayerPage, spec: TileSpec): WhoHeIsTile | null {
  if (spec.kind === 'baseline') {
    const v = page.baseline?.[spec.key];
    if (v === undefined || v === null) return null;
    const label = spec.label ?? BASELINE_LABELS[spec.key];
    const display =
      spec.key === 'total_td'
        ? formatPerGame(v, Number.isInteger(v) ? 0 : 1)
        : formatPerGame(v, 1);
    return {
      key: `baseline.${spec.key}`,
      label,
      display,
      pctile: null,
      descriptive: true,
      tip: spec.tip ?? BASELINE_TIPS[spec.key],
    };
  }

  if (spec.kind === 'comp_pct') {
    const overall = page.scheme?.player_overall;
    if (!isQbOverall(overall) || overall.comp_pct == null) return null;
    return {
      key: 'scheme.comp_pct',
      label: NGS_LABELS.comp_pct ?? 'Completion %',
      display: `${formatPerGame(overall.comp_pct * 100, 0)}%`,
      pctile: null,
      descriptive: true,
      tip: NGS_TIPS.comp_pct,
    };
  }

  const raw = page.ngs?.[spec.key];
  if (!isMetric(raw)) return null;
  const pctile =
    raw.pctile === null || raw.pctile === undefined || Number.isNaN(Number(raw.pctile))
      ? null
      : Number(raw.pctile);
  return {
    key: `ngs.${spec.key}`,
    label: spec.label ?? NGS_LABELS[spec.key] ?? spec.key,
    display: formatNgsValue(spec.key, Number(raw.v)),
    pctile,
    descriptive: pctile == null,
    tip: spec.tip ?? NGS_TIPS[spec.key],
  };
}

export function resolveWhoHeIsTiles(
  page: NflPropPlayerPage,
  marketKey: string
): { headline: WhoHeIsTile[]; more: WhoHeIsTile[] } {
  const map = resolveMap(page, marketKey);
  const headline = map.headline
    .map((s) => resolveSpec(page, s))
    .filter(Boolean) as WhoHeIsTile[];
  const more = map.more
    .map((s) => resolveSpec(page, s))
    .filter(Boolean) as WhoHeIsTile[];
  return { headline, more };
}

export function tileBadge(tile: WhoHeIsTile): string | null {
  if (tile.descriptive || tile.pctile == null) return null;
  return topBadge(tile.pctile);
}
