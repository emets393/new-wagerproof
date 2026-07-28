import type { Tier } from '@/hooks/usePlayerPropPerformance';
import type { PropPick } from '@/utils/dailyPropsReport';

export const TIER_ORDER: Tier[] = ['elite', 'strong', 'lean'];

export const TIER_LABEL: Record<Tier, string> = {
  elite: 'Elite',
  strong: 'Strong',
  lean: 'Lean',
};

export const STAKE_LEGEND = 'Lean 0.5u · Strong 1.0u · Elite 1.5u';

export function fmtUnits(v: number | null | undefined, signed = true): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const n = Number(v);
  const s = (Math.round(n * 100) / 100).toFixed(2);
  if (!signed) return `${s}u`;
  return `${n >= 0 ? '+' : ''}${s}u`;
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${Number(v).toFixed(1)}%`;
}

export function unitsTone(units: number | null | undefined): string {
  if (units == null || !Number.isFinite(units)) return 'text-muted-foreground';
  if (units > 0) return 'text-emerald-600 dark:text-emerald-300';
  if (units < 0) return 'text-red-600 dark:text-red-300';
  return 'text-muted-foreground';
}

export function tierPillClass(tier: PropPick['tier'] | Tier): string {
  if (tier === 'elite') return 'bg-primary text-primary-foreground';
  if (tier === 'strong') return 'bg-primary/80 text-primary-foreground';
  return 'bg-muted text-foreground';
}

export function tierBorderClass(tier: PropPick['tier'] | Tier): string {
  if (tier === 'elite') return 'border-primary/50';
  if (tier === 'strong') return 'border-primary/30';
  return 'border-black/5 dark:border-white/10';
}

export function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
