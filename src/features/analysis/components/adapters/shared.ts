/**
 * Sport-agnostic pure helpers shared by every adapter + the visual components.
 * Lifted verbatim from the three retired Historical Analysis pages so behavior can't drift.
 */
import type { AnalysisResponse, Bar, Opt, Overall } from './types';

// ── range → p_filters helpers (identical in all 3 old pages) ──────────────────────────────────
/** Apply a dual-thumb range to p_filters only when it differs from the default. */
export function applyNumRange(
  f: Record<string, unknown>,
  key: string,
  range: [number, number],
  def: [number, number],
) {
  if (range[0] > def[0]) f[`${key}_min`] = range[0];
  if (range[1] < def[1]) f[`${key}_max`] = range[1];
}
/** Percent UI is 0–100; RPC expects 0–1. */
export function applyPctRange(
  f: Record<string, unknown>,
  key: string,
  range: [number, number],
  def: [number, number] = [0, 100],
) {
  if (range[0] > def[0]) f[`${key}_min`] = Math.round(range[0]) / 100;
  if (range[1] < def[1]) f[`${key}_max`] = Math.round(range[1]) / 100;
}
export function rangeChanged(a: [number, number], b: [number, number]) {
  return a[0] !== b[0] || a[1] !== b[1];
}

// ── significance (identical copy) ─────────────────────────────────────────────────────────────
export function significance(n: number, hit: number): { label: string; tone: string } {
  const dev = Math.abs(hit - 50);
  if (n < 20) return { label: 'Thin sample', tone: 'bg-muted text-muted-foreground' };
  if (n >= 60 && dev >= 5)
    return { label: 'Strong', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
  if (n >= 30 && dev >= 3)
    return { label: 'Solid', tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' };
  return { label: 'Neutral', tone: 'bg-muted text-muted-foreground' };
}

// ── total-market overall/bars recovery (NFL is_home de-dupe edge case) ────────────────────────
/**
 * Game totals de-dupe via `is_home` in the RPC so each game counts once. Team-perspective filters
 * can leave only the away row matching — overall.n becomes 0 while coverage + by_team still have
 * games. Rebuild overall from by_team (hit is the game O/U, identical on both sides).
 */
export function recoverGameLevelOverall(data: AnalysisResponse): Overall | null {
  if (data.overall && data.overall.n > 0) return data.overall;
  const rows = data.by_team || [];
  if (!rows.length || !(data.coverage?.n_games > 0)) return null;
  const n = rows.reduce((s, r) => s + (Number(r.n) || 0), 0);
  if (n <= 0) return null;
  const winSum = rows.reduce((s, r) => s + ((Number(r.hit_pct) || 0) / 100) * (Number(r.n) || 0), 0);
  const hit = winSum / n;
  return {
    n,
    wins: Math.round(winSum),
    hit_pct: Math.round(hit * 1000) / 10,
    roi: Math.round((hit * 1.909 - 1) * 1000) / 10,
  };
}

export function recoverTotalBars(overall: Overall): Bar[] {
  const hit = (overall.hit_pct || 0) / 100;
  const underHit = 1 - hit;
  return [
    {
      dimension: 'over_under',
      options: [
        { side: 'over', n: overall.n, wins: overall.wins, hit_pct: overall.hit_pct, roi: overall.roi },
        {
          side: 'under',
          n: overall.n,
          wins: Math.max(0, overall.n - overall.wins),
          hit_pct: Math.round(underHit * 1000) / 10,
          roi: Math.round((underHit * 1.909 - 1) * 1000) / 10,
        },
      ],
    },
  ];
}

// ── side-market symmetry slices (identical copy) ──────────────────────────────────────────────
export type SideSlice = { dimension: string; extreme: Opt; other: Opt };
export const SIDE_CHIP_LABEL: Record<string, string> = {
  home: 'Home',
  away: 'Away',
  favorite: 'Favorites',
  underdog: 'Underdogs',
};

export function pickSideSlices(bars: Bar[] | undefined): SideSlice[] {
  const out: SideSlice[] = [];
  for (const bar of bars || []) {
    if (bar.dimension !== 'home_away' && bar.dimension !== 'fav_dog') continue;
    const opts = (bar.options || []).filter((o) => o.n > 0 && SIDE_CHIP_LABEL[o.side]);
    if (opts.length < 2) continue;
    const sorted = [...opts].sort((a, b) => b.hit_pct - a.hit_pct);
    out.push({ dimension: bar.dimension, extreme: sorted[0], other: sorted[1] });
  }
  out.sort((a, b) => b.extreme.hit_pct - a.extreme.hit_pct);
  return out;
}

export const DIM_LABEL: Record<string, string> = {
  over_under: 'Over / Under',
  home_away: 'Home vs Away',
  fav_dog: 'Favorite vs Underdog',
};

// ── kickoff formatting (NFL/CFB) ──────────────────────────────────────────────────────────────
export function fmtKick(iso?: string): string {
  if (!iso) return '';
  try {
    return (
      new Date(iso).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York',
      }) + ' ET'
    );
  } catch {
    return '';
  }
}

/** MLB kickoff — time_et + game_date. */
export function fmtKickMlb(timeEt?: string, gameDate?: string): string {
  if (!timeEt && !gameDate) return '';
  try {
    if (gameDate && timeEt) {
      const iso = `${gameDate}T${timeEt.length === 5 ? `${timeEt}:00` : timeEt}`;
      return (
        new Date(iso).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York',
        }) + ' ET'
      );
    }
    if (timeEt) return `${timeEt} ET`;
    return gameDate || '';
  } catch {
    return [gameDate, timeEt].filter(Boolean).join(' ') + ' ET';
  }
}

export function fmtMlOdds(s: string): string {
  const n = Number(s);
  return n > 0 ? `+${n}` : `${n}`;
}

/** Compute the visible breakdown bars: real two-sided splits only (each side ≥10% of the total). */
export function filterShownBars(bars: Bar[], hideSide: boolean): Bar[] {
  return bars.filter((bar) => {
    if (hideSide && (bar.dimension === 'home_away' || bar.dimension === 'fav_dog')) return false;
    const total = bar.options.reduce((s, o) => s + (o?.n || 0), 0);
    return total > 0 && bar.options.every((o) => o && o.n > 0 && o.n / total >= 0.1);
  });
}
