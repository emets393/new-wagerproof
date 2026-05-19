import type { BatterRecentForm, BatterSplitRow } from '@/types/mlb-matchups';

/** Season weight when blending season + L10 (remainder goes to L10). */
export const BLEND_SEASON_WEIGHT = 0.65;

/** Minimum L10 batted-ball events to use recent form in scoring / badges. */
export const MIN_L10_BBE = 10;

/** Minimum hotness score to appear in Hottest Hitters column. */
export const HOTNESS_MIN_SCORE = 60;

/** Hot/cold badge: barrel rate delta (percentage points). */
export const HOT_BARREL_DELTA_PP = 5;
export const HOT_HARD_HIT_DELTA_PP = 8;
export const HOT_XWOBA_DELTA = 0.05;

/** Show season → L10 sub-line in score breakdown when change exceeds this (pp). */
export const BREAKDOWN_MATERIAL_PP = 3;
export const BREAKDOWN_MATERIAL_XWOBA = 0.025;

/**
 * Weighted blend of season + L10. Falls back to season-only if L10 sample is too small.
 */
export function blendStat(
  season: number | null | undefined,
  recent: number | null | undefined,
  recentBBE: number,
  seasonWeight: number = BLEND_SEASON_WEIGHT,
): number | null {
  if (season == null && recent == null) return null;
  if (season == null) return recent ?? null;
  if (recent == null || recentBBE < MIN_L10_BBE) return season;
  return season * seasonWeight + recent * (1 - seasonWeight);
}

export function countHotSignals(batter: BatterSplitRow, recent: BatterRecentForm): number {
  const barrelDelta = (recent.barrel_pct ?? 0) - (batter.barrel_pct ?? 0);
  const hardHitDelta = (recent.hard_hit_pct ?? 0) - (batter.hard_hit_pct ?? 0);
  const xwobaDelta = (recent.xwoba ?? 0) - (batter.xwoba ?? 0);
  return [
    barrelDelta >= HOT_BARREL_DELTA_PP,
    hardHitDelta >= HOT_HARD_HIT_DELTA_PP,
    xwobaDelta >= HOT_XWOBA_DELTA,
  ].filter(Boolean).length;
}

export function countColdSignals(batter: BatterSplitRow, recent: BatterRecentForm): number {
  const barrelDelta = (recent.barrel_pct ?? 0) - (batter.barrel_pct ?? 0);
  const hardHitDelta = (recent.hard_hit_pct ?? 0) - (batter.hard_hit_pct ?? 0);
  const xwobaDelta = (recent.xwoba ?? 0) - (batter.xwoba ?? 0);
  return [
    barrelDelta <= -HOT_BARREL_DELTA_PP,
    hardHitDelta <= -HOT_HARD_HIT_DELTA_PP,
    xwobaDelta <= -HOT_XWOBA_DELTA,
  ].filter(Boolean).length;
}

export function formatPctStat(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

export function formatXwobaStat(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `.${Math.round(value * 1000)}`;
}

export function blendDeltaSubline(
  label: string,
  season: number | null | undefined,
  recent: number | null | undefined,
  format: (v: number) => string,
  materialThreshold: number,
): string | null {
  if (season == null || recent == null || !Number.isFinite(season) || !Number.isFinite(recent)) {
    return null;
  }
  if (Math.abs(recent - season) < materialThreshold) return null;
  const arrow = recent > season ? '↑' : '↓';
  return `↳ ${label} ${format(season)} season → ${format(recent)} L10 ${arrow}`;
}
