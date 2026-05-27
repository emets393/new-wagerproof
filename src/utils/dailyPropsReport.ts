// Daily props ranking — pure functions, no React, no network.
// Consumes the data already loaded by useTodaysMatchupGames + useAllMatchupData
// + useAllPlayerProps + useLeagueBenchmarks and returns ranked picks.

import type {
  BatterSplitRow,
  LeagueBenchmarks,
  LineupRow,
  MatchupGame,
  PitcherBattedBallProfile,
  PitcherMatchupData,
} from '@/types/mlb-matchups';
import type { MlbPlayerPropRow, PropComputedAtLine } from '@/types/mlb-player-props';
import {
  computePropAtLine,
  defaultLine,
  marketLabel,
} from '@/utils/mlbPlayerProps';
import { resolveBenchmark } from '@/hooks/useLeagueBenchmarks';
import type { PitcherStartLog } from '@/hooks/usePitcherRecentStarts';

/**
 * Algorithm version — BUMP this on every meaningful scoring change in this
 * file (new signals, changed weights, different cutoffs, juice cap, etc.).
 *
 * The snapshot RPC stamps each pick with the version that created it.
 * The performance dashboard view auto-filters to the latest version present
 * for each report_date, so a mid-day deploy never contaminates the
 * dashboard with picks from the previous algo.
 *
 * Changelog:
 *   1 — initial algo (over-only, 80/70/60 cutoffs)
 *   2 — Under-side support, sample-size penalty relaxed
 *   3 — juice cap at -180 and posted-odds requirement
 *   4 — pitcher L3 form signal + cutoffs unified at 80/70/60
 *   5 — current (locked in 2026-05-26 evening, post-tuning-day)
 */
export const ALGO_VERSION = 5;

export type PickTier = 'elite' | 'strong' | 'lean';

export interface PickRationale {
  label: string;
  /** Signed contribution to the final score. */
  points: number;
}

export type PickSide = 'over' | 'under';

export interface PropPick {
  kind: 'batter' | 'pitcher';
  tier: PickTier;
  score: number;
  game_pk: number;
  game_label: string;        // "Rays @ Orioles"
  game_time: string | null;
  is_day: boolean;
  player_id: number;
  player_name: string;
  team_name: string | null;
  market: string;
  market_label: string;
  line: number;
  /** Which side of the line the algo is recommending. */
  side: PickSide;
  over_odds: number | null;
  under_odds: number | null;
  /** Hit count + rate for the SIDE being recommended (i.e. cleared for Over, missed for Under). */
  l10_over: number;
  l10_games: number;
  l10_pct: number | null;
  emoji: string;             // e.g. 🔥 / ⭐ / 👍
  rationale: PickRationale[]; // bullet list of why
  /** True once the snapshot RPC has frozen this pick (game has started). */
  locked?: boolean;
}

export interface DailyPropsReport {
  generated_at: string;
  games_count: number;
  batter_picks: PropPick[];
  pitcher_picks: PropPick[];
}

interface ScoreInput {
  market: string;
  computed: PropComputedAtLine;
  isDayTonight: boolean;
}

// Loosened cutoffs. The first pass at 80/70/60 was too tight against a max
// theoretical pitcher score of ~70 — barely any pitcher props could qualify
// and the overall slate produced ~4 picks. New ceiling math: batters can hit
// ~95 (40 L10 + 20 day/night + 15 archetype + 20 underlying), pitchers can
// hit ~85 with the new season-quality bonus, so these thresholds keep tiering
// meaningful without starving the page.
// Tier cutoffs — minimum to surface is 60. Adjust here if the slate produces
// too many / too few picks at any tier.
function tierOf(score: number): PickTier | null {
  if (score >= 80) return 'elite';
  if (score >= 70) return 'strong';
  if (score >= 60) return 'lean';
  return null;
}

function emojiFor(tier: PickTier): string {
  if (tier === 'elite') return '🔥';
  if (tier === 'strong') return '⭐';
  return '👍';
}

function pctBucket(
  value: number | null | undefined,
  bench: { p10?: number; p25?: number; p50?: number; p75?: number; p90?: number } | null | undefined,
  lowerIsBetter = false,
): 'elite' | 'good' | 'neutral' | 'poor' {
  if (value == null || !bench) return 'neutral';
  if (lowerIsBetter) {
    if (bench.p10 != null && value <= bench.p10) return 'elite';
    if (bench.p25 != null && value <= bench.p25) return 'good';
    if (bench.p75 != null && value >= bench.p75) return 'poor';
    return 'neutral';
  }
  if (bench.p90 != null && value >= bench.p90) return 'elite';
  if (bench.p75 != null && value >= bench.p75) return 'good';
  if (bench.p25 != null && value <= bench.p25) return 'poor';
  return 'neutral';
}

// --------------------------------------------------------------------------
// BATTERS

interface BatterContext {
  row: MlbPlayerPropRow;
  game: MatchupGame;
  team_name: string;
  split?: BatterSplitRow;
  benchmarks: LeagueBenchmarks;
}

// Anything priced worse than -180 (implied prob ≥64.3%) is rejected outright —
// you'd need >64% true win rate to break even, and a 10-game sample can't
// confidently support that edge. This is the single biggest fix for "way
// too many Under picks": heavy-favorite Unders (e.g. Under 0.5 HR at -480)
// look great on L10 but offer zero long-term edge.
const MAX_NEGATIVE_ODDS = -180;

// "Flip" a split so its fraction represents the OPPOSITE side of the line.
// Used to evaluate Under picks from the same `computed` data: over_count
// becomes (games - over_count). Pushes are effectively impossible for the
// .5 lines that dominate the slate, so this is exact for those and a tiny
// rounding error on rare integer lines.
type Split = { over: number; games: number; pct: number | null };
function flipSplit(s: Split | null | undefined): Split | null {
  if (!s) return null;
  const newOver = Math.max(0, s.games - s.over);
  return {
    over: newOver,
    games: s.games,
    pct: s.games > 0 ? Math.round((newOver / s.games) * 100) : null,
  };
}
function sideSplits(c: PropComputedAtLine, side: PickSide): {
  l10: Split;
  contextualDayNight: Split | null;
  contextualArchetype: Split | null;
} {
  if (side === 'over') {
    return {
      l10: c.l10,
      contextualDayNight: c.contextualDayNight,
      contextualArchetype: c.contextualArchetype,
    };
  }
  return {
    l10: flipSplit(c.l10) ?? c.l10,
    contextualDayNight: flipSplit(c.contextualDayNight),
    contextualArchetype: flipSplit(c.contextualArchetype),
  };
}

function scoreBatter(
  { row, split, benchmarks }: BatterContext,
  line: number,
  side: PickSide,
): {
  score: number;
  computed: PropComputedAtLine;
  rationale: PickRationale[];
  oddsMultiplier: number;
  l10: Split;
} | null {
  const computed = computePropAtLine(row, line);
  if (!computed) return null;

  // Gate on the price of the SIDE we're picking — never recommend something
  // we don't have a posted price for, and never recommend juicier than the
  // max-negative-odds threshold (no realistic long-term edge there).
  const sideOddsGate = side === 'over' ? computed.overOdds : computed.underOdds;
  if (sideOddsGate == null) return null;
  if (sideOddsGate < MAX_NEGATIVE_ODDS) return null;

  const { l10, contextualDayNight, contextualArchetype } = sideSplits(computed, side);
  if (l10.pct == null || l10.games < 3) return null;

  const sideLabel = side === 'over' ? 'Over' : 'Under';
  // For Under picks, "good batter trends" are inverted: declining xwOBA / barrel%
  // and rising K% all favor going Under (the batter is contributing less).
  const dir = side === 'over' ? 1 : -1;

  const rationale: PickRationale[] = [];
  let score = 0;

  // 1. L10 hit rate (40 pts) -------------------------------------------------
  const l10Points = l10.pct * 0.4;
  score += l10Points;
  rationale.push({
    label: `L10 ${sideLabel} ${l10.over}/${l10.games} (${l10.pct}%)`,
    points: l10Points,
  });
  if (l10.games < 4) {
    score -= 6;
    rationale.push({ label: 'Small L10 sample', points: -6 });
  }

  // 2. Day/Night fit (15 pts) -----------------------------------------------
  if (contextualDayNight && contextualDayNight.games >= 5) {
    const dn = contextualDayNight;
    if (dn.pct != null && dn.pct >= l10.pct - 5) {
      const dnPoints = 15 * Math.min(1, dn.pct / 100);
      score += dnPoints;
      rationale.push({
        label: `${row.game_is_day ? '☀️ Day' : '🌙 Night'} games ${dn.over}/${dn.games} (${dn.pct}%)`,
        points: dnPoints,
      });
    }
  }

  // 3. Archetype fit (15 pts) -----------------------------------------------
  if (contextualArchetype && contextualArchetype.games >= 4 && row.opp_archetype_today) {
    const arch = contextualArchetype;
    if (arch.pct != null && arch.pct >= l10.pct - 5) {
      const archPoints = 15 * Math.min(1, arch.pct / 100);
      score += archPoints;
      rationale.push({
        label: `vs ${row.opp_archetype_today} SP ${arch.over}/${arch.games} (${arch.pct}%)`,
        points: archPoints,
      });
    }
  }

  // 4. Underlying form (20 pts) — directions flip for Under picks ----------
  if (split) {
    const recent = split.recent_form;
    const xwoba = split.xwoba ?? null;
    const recentXwoba = recent?.xwoba ?? null;
    if (xwoba != null && recentXwoba != null) {
      const delta = (recentXwoba - xwoba) * dir;
      if (delta >= 0.020) {
        score += 8;
        rationale.push({
          label: `L10 xwOBA ${dir > 0 ? '+' : ''}${(recentXwoba - xwoba).toFixed(3)} vs season`,
          points: 8,
        });
      } else if (delta >= 0.010) {
        score += 4;
        rationale.push({
          label: `L10 xwOBA ${dir > 0 ? '+' : ''}${(recentXwoba - xwoba).toFixed(3)} vs season`,
          points: 4,
        });
      } else if (delta <= -0.020) {
        score -= 4;
        rationale.push({
          label: `L10 xwOBA ${(recentXwoba - xwoba).toFixed(3)} vs season (wrong way for ${sideLabel})`,
          points: -4,
        });
      }
    }
    const barrel = split.barrel_pct ?? null;
    const recentBarrel = recent?.barrel_pct ?? null;
    if (barrel != null && recentBarrel != null) {
      const delta = (recentBarrel - barrel) * dir;
      if (delta >= 3) {
        score += 6;
        rationale.push({
          label: `L10 barrel% ${dir > 0 ? '+' : ''}${(recentBarrel - barrel).toFixed(1)}pp`,
          points: 6,
        });
      } else if (delta <= -3) {
        score -= 3;
        rationale.push({
          label: `L10 barrel% ${(recentBarrel - barrel).toFixed(1)}pp (wrong way)`,
          points: -3,
        });
      }
    }
    const hard = split.hard_hit_pct ?? null;
    const recentHard = recent?.hard_hit_pct ?? null;
    if (hard != null && recentHard != null && (recentHard - hard) * dir >= 3) {
      score += 3;
      rationale.push({
        label: `L10 hard-hit% ${dir > 0 ? '+' : ''}${(recentHard - hard).toFixed(1)}pp`,
        points: 3,
      });
    }
    // For K%, the natural direction is "more K = bad for OVER batter props" — so we
    // flip the sign vs the other indicators (it's lower-is-better for hit/HR
    // markets, but for the batter_strikeouts market UNDER, low K% is good).
    const isBatterKMarket = row.market === 'batter_strikeouts';
    const kDir = isBatterKMarket ? dir : -dir; // K% rising hurts most Over batter props
    const k = split.k_pct ?? null;
    const recentK = recent?.k_pct ?? null;
    if (k != null && recentK != null) {
      const delta = (recentK - k) * kDir;
      if (delta >= 3) {
        score += 3;
        rationale.push({
          label: `L10 K% ${recentK > k ? '+' : ''}${(recentK - k).toFixed(1)}pp`,
          points: 3,
        });
      } else if (delta <= -3) {
        score -= 3;
        rationale.push({
          label: `L10 K% ${(recentK - k).toFixed(1)}pp (wrong way for ${sideLabel})`,
          points: -3,
        });
      }
    }

    // Season percentile bonus for xwOBA — "good batter regardless of trend"
    // For Under picks, a POOR season xwOBA is the signal.
    const xwobaBench = resolveBenchmark(benchmarks, 'xwoba');
    const bucket = pctBucket(xwoba, xwobaBench);
    if (side === 'over') {
      if (bucket === 'elite')      { score += 5; rationale.push({ label: 'Elite season xwOBA vs this hand', points: 5 }); }
      else if (bucket === 'good')  { score += 2; rationale.push({ label: 'Above-avg season xwOBA vs this hand', points: 2 }); }
      else if (bucket === 'poor')  { score -= 4; rationale.push({ label: 'Below-avg season xwOBA vs this hand', points: -4 }); }
    } else {
      if (bucket === 'poor')       { score += 5; rationale.push({ label: 'Weak season xwOBA vs this hand (Under signal)', points: 5 }); }
      else if (bucket === 'neutral') { /* neutral */ }
      else if (bucket === 'elite') { score -= 4; rationale.push({ label: 'Elite season xwOBA vs this hand (wrong way for Under)', points: -4 }); }
    }
  }

  // 5. Odds sanity (×modifier) — uses the price for the SIDE we're picking --
  const sideOdds = side === 'over' ? computed.overOdds : computed.underOdds;
  let oddsMultiplier = 1;
  if (sideOdds != null) {
    if (sideOdds >= 150) {
      oddsMultiplier = 1.05;
      rationale.push({ label: `Plus-money ${sideLabel} (${sideOdds})`, points: 0 });
    } else if (sideOdds <= -180) {
      oddsMultiplier = 0.95;
      rationale.push({ label: `Heavy juice on ${sideLabel} (${sideOdds})`, points: 0 });
    }
  }

  return {
    score: Math.max(0, Math.min(100, score * oddsMultiplier)),
    computed,
    rationale,
    oddsMultiplier,
    l10,
  };
}

// --------------------------------------------------------------------------
// PITCHERS

interface PitcherContext {
  row: MlbPlayerPropRow;
  game: MatchupGame;
  team_name: string;
  /** Opposing lineup batter splits vs THIS pitcher's hand (i.e. the splits
   *  that already use vs_pitcher_hand = this pitcher). Used to gauge how strikeout-prone
   *  the lineup is recently. */
  opposingLineupSplits: BatterSplitRow[];
  opposingLineup: LineupRow[];
  benchmarks: LeagueBenchmarks; // benchmarks vs this pitcher's hand
  /** This pitcher's season batted-ball / rate profile (overall + by batter hand). */
  pitcherBattedBall: PitcherBattedBallProfile | null;
  /** This pitcher's last 3 completed starts (newest first). Drives the recent-form signal. */
  recentStarts: PitcherStartLog[];
}

// Average a list of numbers, skipping nulls. Returns null if no real values.
function avgOrNull(values: (number | null | undefined)[]): number | null {
  const real = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (real.length === 0) return null;
  return real.reduce((a, b) => a + b, 0) / real.length;
}

function scorePitcher(
  { row, opposingLineupSplits, benchmarks, pitcherBattedBall, recentStarts }: PitcherContext,
  line: number,
  side: PickSide,
): {
  score: number;
  computed: PropComputedAtLine;
  rationale: PickRationale[];
  oddsMultiplier: number;
  l10: Split;
} | null {
  const computed = computePropAtLine(row, line);
  if (!computed) return null;

  const sideOddsGate = side === 'over' ? computed.overOdds : computed.underOdds;
  if (sideOddsGate == null) return null;
  if (sideOddsGate < MAX_NEGATIVE_ODDS) return null;

  const { l10, contextualDayNight } = sideSplits(computed, side);
  if (l10.pct == null || l10.games < 3) return null;

  const sideLabel = side === 'over' ? 'Over' : 'Under';
  const dir = side === 'over' ? 1 : -1;

  const rationale: PickRationale[] = [];
  let score = 0;

  // 1. L10 hit rate (40 pts) ------------------------------------------------
  const l10Points = l10.pct * 0.4;
  score += l10Points;
  rationale.push({
    label: `L10 ${sideLabel} ${l10.over}/${l10.games} (${l10.pct}%)`,
    points: l10Points,
  });

  // 2. Day/Night fit (10 pts) -----------------------------------------------
  if (contextualDayNight && contextualDayNight.games >= 4) {
    const dn = contextualDayNight;
    if (dn.pct != null && dn.pct >= l10.pct - 5) {
      const dnPoints = 10 * Math.min(1, dn.pct / 100);
      score += dnPoints;
      rationale.push({
        label: `${row.game_is_day ? '☀️ Day' : '🌙 Night'} starts ${dn.over}/${dn.games} (${dn.pct}%)`,
        points: dnPoints,
      });
    }
  }

  // 3. Pitcher season quality (up to 15 pts) — directions flip for Under ----
  if (pitcherBattedBall?.overall) {
    const o = pitcherBattedBall.overall;
    if (row.market === 'pitcher_strikeouts') {
      const kBench = resolveBenchmark(benchmarks, 'k_pct');
      // OVER strikeouts loves high pitcher K%; UNDER loves low pitcher K%.
      if (o.k_pct != null && kBench) {
        const elite = side === 'over'
          ? (kBench.p75 != null && o.k_pct >= kBench.p75)
          : (kBench.p25 != null && o.k_pct <= kBench.p25);
        const good = side === 'over'
          ? (kBench.p50 != null && o.k_pct >= kBench.p50)
          : (kBench.p50 != null && o.k_pct <= kBench.p50);
        const wrong = side === 'over'
          ? (kBench.p25 != null && o.k_pct <= kBench.p25)
          : (kBench.p75 != null && o.k_pct >= kBench.p75);
        if (elite) {
          score += 15;
          rationale.push({ label: `Season K% ${o.k_pct.toFixed(1)}% (great for ${sideLabel})`, points: 15 });
        } else if (good) {
          score += 8;
          rationale.push({ label: `Season K% ${o.k_pct.toFixed(1)}% (favors ${sideLabel})`, points: 8 });
        } else if (wrong) {
          score -= 4;
          rationale.push({ label: `Season K% ${o.k_pct.toFixed(1)}% (against ${sideLabel})`, points: -4 });
        }
      }
    } else {
      // hits-allowed / walks / outs: low xwOBA-A favors UNDER, high favors OVER.
      if (o.xwoba_allowed != null) {
        if (dir > 0) {
          if (o.xwoba_allowed >= 0.350) { score += 8; rationale.push({ label: `Weak season xwOBA-A (${o.xwoba_allowed.toFixed(3)})`, points: 8 }); }
          else if (o.xwoba_allowed <= 0.300) { score -= 4; rationale.push({ label: `Strong season xwOBA-A (${o.xwoba_allowed.toFixed(3)})`, points: -4 }); }
        } else {
          if (o.xwoba_allowed <= 0.300) { score += 8; rationale.push({ label: `Strong season xwOBA-A (${o.xwoba_allowed.toFixed(3)}) — Under signal`, points: 8 }); }
          else if (o.xwoba_allowed >= 0.350) { score -= 4; rationale.push({ label: `Weak season xwOBA-A (${o.xwoba_allowed.toFixed(3)}) — wrong way for Under`, points: -4 }); }
        }
      }
    }
  }

  // 3b. Pitcher last-3-starts form (up to 15 pts) ---------------------------
  // The recent-form signal pitchers were missing — they now have the same
  // shot at >70 scores that batters do via their L10 underlying-form bonuses.
  // Compares L3 K% / xwOBA-A / depth vs the pitcher's full-season baseline.
  if (recentStarts.length >= 2 && pitcherBattedBall?.overall) {
    const o = pitcherBattedBall.overall;
    const l3K = avgOrNull(recentStarts.map(s => s.k_pct));
    const l3Xwoba = avgOrNull(recentStarts.map(s => s.xwoba_allowed));
    const l3Ip = avgOrNull(recentStarts.map(s => s.ip_official));

    // K% trend — positive delta favors Over K (rising strikeouts), negative
    // delta favors Under K. Apply direction × side.
    if (l3K != null && o.k_pct != null) {
      const rawDelta = l3K - o.k_pct;
      const dirDelta = rawDelta * dir;
      if (dirDelta >= 3) {
        score += 5;
        rationale.push({
          label: `L3 K% ${rawDelta > 0 ? '+' : ''}${rawDelta.toFixed(1)}pp vs season`,
          points: 5,
        });
      } else if (dirDelta >= 1.5) {
        score += 3;
        rationale.push({
          label: `L3 K% ${rawDelta > 0 ? '+' : ''}${rawDelta.toFixed(1)}pp vs season`,
          points: 3,
        });
      } else if (dirDelta <= -3) {
        score -= 3;
        rationale.push({
          label: `L3 K% ${rawDelta.toFixed(1)}pp (wrong way for ${sideLabel})`,
          points: -3,
        });
      }
    }

    // xwOBA-A trend — LOWER recent xwOBA-A means pitcher's been tougher to
    // hit, which favors UNDER on hits/TB/runs-allowed and favors OVER on K
    // (a pitcher dominating contact also tends to rack up Ks). We'll use
    // direction × -1 (lower-is-better) modulated by side. For K market, a
    // dropping xwOBA-A is a STRENGTH signal regardless of side, but Over
    // benefits more — keep simple: lower xwOBA-A always favors strong Over /
    // strong Under K (so add to whichever side scores higher elsewhere).
    if (l3Xwoba != null && o.xwoba_allowed != null) {
      const rawDelta = l3Xwoba - o.xwoba_allowed;
      // For non-K markets, the direction of "lower xwOBA-A" depends on side:
      // OVER hits-allowed wants HIGHER recent xwOBA-A (pitcher slipping),
      // UNDER hits-allowed wants LOWER recent xwOBA-A (pitcher tightening).
      const xwobaDir = row.market === 'pitcher_strikeouts' ? -1 : dir;
      const dirDelta = rawDelta * xwobaDir;
      if (dirDelta >= 0.020) {
        score += 5;
        rationale.push({
          label: `L3 xwOBA-A ${rawDelta > 0 ? '+' : ''}${rawDelta.toFixed(3)} vs season`,
          points: 5,
        });
      } else if (dirDelta >= 0.010) {
        score += 3;
        rationale.push({
          label: `L3 xwOBA-A ${rawDelta > 0 ? '+' : ''}${rawDelta.toFixed(3)} vs season`,
          points: 3,
        });
      } else if (dirDelta <= -0.020) {
        score -= 3;
        rationale.push({
          label: `L3 xwOBA-A ${rawDelta.toFixed(3)} (wrong way for ${sideLabel})`,
          points: -3,
        });
      }
    }

    // Depth — going deep into games gives more K opportunities (helps Over K)
    // and tends to suppress hits-allowed Unders (pitcher staying in = more
    // runners). Only counts for Over K props; otherwise we skip to avoid
    // double-counting with the season quality signal.
    if (l3Ip != null && row.market === 'pitcher_strikeouts' && side === 'over') {
      if (l3Ip >= 6) {
        score += 5;
        rationale.push({ label: `L3 avg ${l3Ip.toFixed(1)} IP per start (deep workload)`, points: 5 });
      } else if (l3Ip >= 5.3) {
        score += 3;
        rationale.push({ label: `L3 avg ${l3Ip.toFixed(1)} IP per start`, points: 3 });
      } else if (l3Ip < 4.5) {
        score -= 3;
        rationale.push({ label: `L3 avg ${l3Ip.toFixed(1)} IP (short outings)`, points: -3 });
      }
    }
  }

  // 4. Opponent vulnerability (20 pts) — flips for Under K props ------------
  const seasonKs = opposingLineupSplits
    .map(s => s.k_pct)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (seasonKs.length >= 4 && row.market === 'pitcher_strikeouts') {
    const avgK = seasonKs.reduce((a, b) => a + b, 0) / seasonKs.length;
    const kBench = resolveBenchmark(benchmarks, 'k_pct');
    // High lineup K% = strikeout-prone lineup = OVER K signal; low K% = contact
    // lineup = UNDER K signal.
    if (kBench) {
      const vulnerable = side === 'over'
        ? (kBench.p75 != null && avgK >= kBench.p75)
        : (kBench.p25 != null && avgK <= kBench.p25);
      const above = side === 'over'
        ? (kBench.p50 != null && avgK >= kBench.p50)
        : (kBench.p50 != null && avgK <= kBench.p50);
      const tough = side === 'over'
        ? (kBench.p25 != null && avgK <= kBench.p25)
        : (kBench.p75 != null && avgK >= kBench.p75);
      if (vulnerable) {
        score += 10;
        rationale.push({ label: `Opp lineup avg K% ${avgK.toFixed(1)}% (favors ${sideLabel})`, points: 10 });
      } else if (above) {
        score += 5;
        rationale.push({ label: `Opp lineup avg K% ${avgK.toFixed(1)}% (slight ${sideLabel} lean)`, points: 5 });
      } else if (tough) {
        score -= 5;
        rationale.push({ label: `Opp lineup avg K% ${avgK.toFixed(1)}% (against ${sideLabel})`, points: -5 });
      }
    }

    const recentKs = opposingLineupSplits
      .map(s => s.recent_form?.k_pct)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (recentKs.length >= 4) {
      const avgRecentK = recentKs.reduce((a, b) => a + b, 0) / recentKs.length;
      const rawDelta = avgRecentK - avgK;
      const delta = rawDelta * dir;
      if (delta >= 2) {
        score += 5;
        rationale.push({
          label: `Opp lineup L10 K% ${rawDelta > 0 ? '+' : ''}${rawDelta.toFixed(1)}pp vs season`,
          points: 5,
        });
      } else if (delta <= -2) {
        score -= 3;
        rationale.push({
          label: `Opp lineup L10 K% ${rawDelta.toFixed(1)}pp (wrong way for ${sideLabel})`,
          points: -3,
        });
      }
    }
  }

  // 5. Odds sanity ----------------------------------------------------------
  const sideOdds = side === 'over' ? computed.overOdds : computed.underOdds;
  let oddsMultiplier = 1;
  if (sideOdds != null) {
    if (sideOdds >= 150) {
      oddsMultiplier = 1.05;
      rationale.push({ label: `Plus-money ${sideLabel} (${sideOdds})`, points: 0 });
    } else if (sideOdds <= -180) {
      oddsMultiplier = 0.95;
      rationale.push({ label: `Heavy juice on ${sideLabel} (${sideOdds})`, points: 0 });
    }
  }

  return {
    score: Math.max(0, Math.min(100, score * oddsMultiplier)),
    computed,
    rationale,
    oddsMultiplier,
    l10,
  };
}

// --------------------------------------------------------------------------
// PUBLIC ENTRY

interface BuildOptions {
  games: MatchupGame[];
  propsByGamePk: Map<number, MlbPlayerPropRow[]>;
  matchupByGamePk: Map<number, PitcherMatchupData>;
  /** Last 3 completed starts per starting-pitcher id, newest first. */
  pitcherStartsByPitcherId: Map<number, PitcherStartLog[]>;
  benchmarksR: LeagueBenchmarks;
  benchmarksL: LeagueBenchmarks;
}

function gameLabel(game: MatchupGame): string {
  return `${game.away_team_name} @ ${game.home_team_name}`;
}

export function buildDailyPropsReport({
  games,
  propsByGamePk,
  matchupByGamePk,
  pitcherStartsByPitcherId,
  benchmarksR,
  benchmarksL,
}: BuildOptions): DailyPropsReport {
  const batterPicks: PropPick[] = [];
  const pitcherPicks: PropPick[] = [];

  for (const game of games) {
    const props = propsByGamePk.get(game.game_pk) ?? [];
    if (props.length === 0) continue;
    const md = matchupByGamePk.get(game.game_pk);

    const lineupSplits = [
      ...(md?.awayLineupSplits ?? []),
      ...(md?.homeLineupSplits ?? []),
    ];
    const splitsById = new Map(lineupSplits.map(s => [s.batter_id, s]));

    for (const row of props) {
      const line = defaultLine(row.lines);
      if (line == null) continue;

      if (!row.is_pitcher) {
        const split = splitsById.get(row.player_id);
        const benchmarks = split?.vs_pitcher_hand === 'L' ? benchmarksL : benchmarksR;
        const team =
          md?.awayLineupSplits.some(s => s.batter_id === row.player_id)
            ? game.away_team_name
            : md?.homeLineupSplits.some(s => s.batter_id === row.player_id)
              ? game.home_team_name
              : null;
        // Score both sides; emit whichever has the higher score (if any tiers).
        const ctx: BatterContext = { row, game, team_name: team ?? '', split, benchmarks };
        const over = scoreBatter(ctx, line, 'over');
        const under = scoreBatter(ctx, line, 'under');
        const best =
          over && (!under || over.score >= under.score)
            ? { result: over, side: 'over' as const }
            : under
              ? { result: under, side: 'under' as const }
              : null;
        if (!best) continue;
        const tier = tierOf(best.result.score);
        if (!tier) continue;
        batterPicks.push({
          kind: 'batter',
          tier,
          emoji: emojiFor(tier),
          score: Math.round(best.result.score),
          game_pk: game.game_pk,
          game_label: gameLabel(game),
          game_time: game.game_time,
          is_day: row.game_is_day,
          player_id: row.player_id,
          player_name: row.player_name,
          team_name: team,
          market: row.market,
          market_label: marketLabel(row.market),
          line,
          side: best.side,
          over_odds: best.result.computed.overOdds,
          under_odds: best.result.computed.underOdds,
          l10_over: best.result.l10.over,
          l10_games: best.result.l10.games,
          l10_pct: best.result.l10.pct,
          rationale: best.result.rationale,
        });
      } else {
        const isAwayPitcher = row.player_id === game.away_sp_id;
        const isHomePitcher = row.player_id === game.home_sp_id;
        if (!isAwayPitcher && !isHomePitcher) continue;
        const opposingLineupSplits = isAwayPitcher
          ? md?.homeLineupSplits ?? []
          : md?.awayLineupSplits ?? [];
        const opposingLineup = isAwayPitcher ? md?.homeLineup ?? [] : md?.awayLineup ?? [];
        const pitcherHand = isAwayPitcher ? game.away_sp_hand : game.home_sp_hand;
        const benchmarks = pitcherHand === 'L' ? benchmarksL : benchmarksR;
        const team = isAwayPitcher ? game.away_team_name : game.home_team_name;
        const pitcherBattedBall = isAwayPitcher
          ? md?.awayBattedBall ?? null
          : md?.homeBattedBall ?? null;
        const recentStarts = pitcherStartsByPitcherId.get(row.player_id) ?? [];
        const ctx: PitcherContext = {
          row, game, team_name: team,
          opposingLineupSplits, opposingLineup, benchmarks, pitcherBattedBall,
          recentStarts,
        };
        const over = scorePitcher(ctx, line, 'over');
        const under = scorePitcher(ctx, line, 'under');
        const best =
          over && (!under || over.score >= under.score)
            ? { result: over, side: 'over' as const }
            : under
              ? { result: under, side: 'under' as const }
              : null;
        if (!best) continue;
        const tier = tierOf(best.result.score);
        if (!tier) continue;
        pitcherPicks.push({
          kind: 'pitcher',
          tier,
          emoji: emojiFor(tier),
          score: Math.round(best.result.score),
          game_pk: game.game_pk,
          game_label: gameLabel(game),
          game_time: game.game_time,
          is_day: row.game_is_day,
          player_id: row.player_id,
          player_name: row.player_name,
          team_name: team,
          market: row.market,
          market_label: marketLabel(row.market),
          line,
          side: best.side,
          over_odds: best.result.computed.overOdds,
          under_odds: best.result.computed.underOdds,
          l10_over: best.result.l10.over,
          l10_games: best.result.l10.games,
          l10_pct: best.result.l10.pct,
          rationale: best.result.rationale,
        });
      }
    }
  }

  batterPicks.sort((a, b) => b.score - a.score);
  pitcherPicks.sort((a, b) => b.score - a.score);

  return {
    generated_at: new Date().toISOString(),
    games_count: games.length,
    batter_picks: batterPicks,
    pitcher_picks: pitcherPicks,
  };
}
