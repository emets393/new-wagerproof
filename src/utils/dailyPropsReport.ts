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

export type PickTier = 'elite' | 'strong' | 'lean';

export interface PickRationale {
  label: string;
  /** Signed contribution to the final score. */
  points: number;
}

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
  over_odds: number | null;
  under_odds: number | null;
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
// Tier cutoffs — minimum to surface is 50. Anything below is hidden so the
// page stays tight. Adjust here if the slate produces too many / too few.
function tierOf(score: number): PickTier | null {
  if (score >= 75) return 'elite';
  if (score >= 62) return 'strong';
  if (score >= 50) return 'lean';
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

function scoreBatter({ row, split, benchmarks }: BatterContext, line: number): {
  score: number;
  computed: PropComputedAtLine;
  rationale: PickRationale[];
  oddsMultiplier: number;
} | null {
  const computed = computePropAtLine(row, line);
  if (!computed) return null;

  const rationale: PickRationale[] = [];
  let score = 0;

  // 1. L10 hit rate (40 pts) -------------------------------------------------
  if (computed.l10.pct == null || computed.l10.games < 3) return null;
  const l10Points = computed.l10.pct * 0.4;
  score += l10Points;
  rationale.push({
    label: `L10 ${computed.l10.over}/${computed.l10.games} (${computed.l10.pct}%)`,
    points: l10Points,
  });
  if (computed.l10.games < 4) {
    score -= 6;
    rationale.push({ label: 'Small L10 sample', points: -6 });
  }

  // 2. Day/Night fit (15 pts) -----------------------------------------------
  if (computed.contextualDayNight && computed.contextualDayNight.games >= 5) {
    const dn = computed.contextualDayNight;
    if (dn.pct != null && computed.l10.pct != null && dn.pct >= computed.l10.pct - 5) {
      const dnPoints = 15 * Math.min(1, (dn.pct ?? 0) / 100);
      score += dnPoints;
      rationale.push({
        label: `${row.game_is_day ? '☀️ Day' : '🌙 Night'} games ${dn.over}/${dn.games} (${dn.pct}%)`,
        points: dnPoints,
      });
    }
  }

  // 3. Archetype fit (15 pts) -----------------------------------------------
  if (computed.contextualArchetype && computed.contextualArchetype.games >= 4 && row.opp_archetype_today) {
    const arch = computed.contextualArchetype;
    if (arch.pct != null && computed.l10.pct != null && arch.pct >= computed.l10.pct - 5) {
      const archPoints = 15 * Math.min(1, (arch.pct ?? 0) / 100);
      score += archPoints;
      rationale.push({
        label: `vs ${row.opp_archetype_today} SP ${arch.over}/${arch.games} (${arch.pct}%)`,
        points: archPoints,
      });
    }
  }

  // 4. Underlying form (20 pts) ---------------------------------------------
  if (split) {
    const recent = split.recent_form;
    const xwoba = split.xwoba ?? null;
    const recentXwoba = recent?.xwoba ?? null;
    if (xwoba != null && recentXwoba != null) {
      const delta = recentXwoba - xwoba;
      if (delta >= 0.020) {
        score += 8;
        rationale.push({ label: `L10 xwOBA +${delta.toFixed(3)} vs season`, points: 8 });
      } else if (delta >= 0.010) {
        score += 4;
        rationale.push({ label: `L10 xwOBA +${delta.toFixed(3)} vs season`, points: 4 });
      } else if (delta <= -0.020) {
        score -= 4;
        rationale.push({ label: `L10 xwOBA ${delta.toFixed(3)} vs season`, points: -4 });
      }
    }
    const barrel = split.barrel_pct ?? null;
    const recentBarrel = recent?.barrel_pct ?? null;
    if (barrel != null && recentBarrel != null) {
      const delta = recentBarrel - barrel;
      if (delta >= 3) {
        score += 6;
        rationale.push({ label: `L10 barrel% +${delta.toFixed(1)}pp`, points: 6 });
      } else if (delta <= -3) {
        score -= 3;
        rationale.push({ label: `L10 barrel% ${delta.toFixed(1)}pp`, points: -3 });
      }
    }
    const hard = split.hard_hit_pct ?? null;
    const recentHard = recent?.hard_hit_pct ?? null;
    if (hard != null && recentHard != null && recentHard - hard >= 3) {
      score += 3;
      rationale.push({
        label: `L10 hard-hit% +${(recentHard - hard).toFixed(1)}pp`,
        points: 3,
      });
    }
    const k = split.k_pct ?? null;
    const recentK = recent?.k_pct ?? null;
    if (k != null && recentK != null && recentK - k >= 3) {
      score -= 3;
      rationale.push({
        label: `L10 K% +${(recentK - k).toFixed(1)}pp (worse)`,
        points: -3,
      });
    }

    // Season percentile bonus for xwOBA — "good batter regardless of trend"
    const xwobaBench = resolveBenchmark(benchmarks, 'xwoba');
    const bucket = pctBucket(xwoba, xwobaBench);
    if (bucket === 'elite') {
      score += 5;
      rationale.push({ label: 'Elite season xwOBA vs this hand', points: 5 });
    } else if (bucket === 'good') {
      score += 2;
      rationale.push({ label: 'Above-avg season xwOBA vs this hand', points: 2 });
    } else if (bucket === 'poor') {
      score -= 4;
      rationale.push({ label: 'Below-avg season xwOBA vs this hand', points: -4 });
    }
  }

  // 5. Odds sanity (×modifier) ----------------------------------------------
  let oddsMultiplier = 1;
  if (computed.overOdds != null) {
    if (computed.overOdds >= 150) {
      oddsMultiplier = 1.05;
      rationale.push({ label: `Plus-money Over (${computed.overOdds})`, points: 0 });
    } else if (computed.overOdds <= -180) {
      oddsMultiplier = 0.95;
      rationale.push({ label: `Heavy juice on Over (${computed.overOdds})`, points: 0 });
    }
  }

  return { score: Math.max(0, Math.min(100, score * oddsMultiplier)), computed, rationale, oddsMultiplier };
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
}

function scorePitcher({
  row,
  opposingLineupSplits,
  benchmarks,
  pitcherBattedBall,
}: PitcherContext, line: number): {
  score: number;
  computed: PropComputedAtLine;
  rationale: PickRationale[];
  oddsMultiplier: number;
} | null {
  const computed = computePropAtLine(row, line);
  if (!computed) return null;
  if (computed.l10.pct == null || computed.l10.games < 3) return null;

  const rationale: PickRationale[] = [];
  let score = 0;

  // 1. L10 hit rate (40 pts) ------------------------------------------------
  const l10Points = computed.l10.pct * 0.4;
  score += l10Points;
  rationale.push({
    label: `L10 ${computed.l10.over}/${computed.l10.games} (${computed.l10.pct}%)`,
    points: l10Points,
  });

  // 2. Day/Night fit (10 pts) -----------------------------------------------
  if (computed.contextualDayNight && computed.contextualDayNight.games >= 4) {
    const dn = computed.contextualDayNight;
    if (dn.pct != null && computed.l10.pct != null && dn.pct >= computed.l10.pct - 5) {
      const dnPoints = 10 * Math.min(1, (dn.pct ?? 0) / 100);
      score += dnPoints;
      rationale.push({
        label: `${row.game_is_day ? '☀️ Day' : '🌙 Night'} starts ${dn.over}/${dn.games} (${dn.pct}%)`,
        points: dnPoints,
      });
    }
  }

  // 3. Pitcher season quality (up to 15 pts) -------------------------------
  // Uses the season batted-ball profile that's already loaded in matchup data —
  // no extra fetch. For pitcher_strikeouts we weight K% heavily; for everything
  // else we use overall xwOBA-allowed (lower = better).
  if (pitcherBattedBall?.overall) {
    const o = pitcherBattedBall.overall;
    if (row.market === 'pitcher_strikeouts') {
      const kBench = resolveBenchmark(benchmarks, 'k_pct');
      // Note: this benchmark is FOR BATTERS, so league p75 K% is "high for a hitter".
      // For pitchers we want HIGH K%, so we compare ascending: above p75 = elite.
      if (o.k_pct != null && kBench?.p75 != null && o.k_pct >= kBench.p75) {
        score += 15;
        rationale.push({ label: `Elite season K% (${o.k_pct.toFixed(1)}%)`, points: 15 });
      } else if (o.k_pct != null && kBench?.p50 != null && o.k_pct >= kBench.p50) {
        score += 8;
        rationale.push({ label: `Above-avg season K% (${o.k_pct.toFixed(1)}%)`, points: 8 });
      } else if (o.k_pct != null && kBench?.p25 != null && o.k_pct <= kBench.p25) {
        score -= 4;
        rationale.push({ label: `Below-avg season K% (${o.k_pct.toFixed(1)}%)`, points: -4 });
      }
    } else {
      // For hits-allowed / walks / outs we lean on xwOBA-A as a quality proxy.
      if (o.xwoba_allowed != null && o.xwoba_allowed <= 0.300) {
        score += 8;
        rationale.push({ label: `Strong season xwOBA-A (${o.xwoba_allowed.toFixed(3)})`, points: 8 });
      } else if (o.xwoba_allowed != null && o.xwoba_allowed >= 0.350) {
        score -= 4;
        rationale.push({ label: `Weak season xwOBA-A (${o.xwoba_allowed.toFixed(3)})`, points: -4 });
      }
    }
  }

  // 4. Opponent vulnerability (20 pts) -- THE pitcher-K signal -------------
  // Average season K% of opposing lineup vs this pitcher's hand
  const seasonKs = opposingLineupSplits
    .map(s => s.k_pct)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (seasonKs.length >= 4) {
    const avgK = seasonKs.reduce((a, b) => a + b, 0) / seasonKs.length;
    const kBench = resolveBenchmark(benchmarks, 'k_pct');
    // For batters, k_pct is "lower is better" — so a HIGH lineup avg K% is bad
    // for the lineup and GREAT for the pitcher. We invert here.
    if (kBench?.p75 != null && avgK >= kBench.p75) {
      score += 10;
      rationale.push({
        label: `Opp lineup avg K% ${avgK.toFixed(1)}% (vulnerable)`,
        points: 10,
      });
    } else if (kBench?.p50 != null && avgK >= kBench.p50) {
      score += 5;
      rationale.push({
        label: `Opp lineup avg K% ${avgK.toFixed(1)}% (above league)`,
        points: 5,
      });
    } else if (kBench?.p25 != null && avgK <= kBench.p25) {
      score -= 5;
      rationale.push({
        label: `Opp lineup avg K% ${avgK.toFixed(1)}% (tough lineup)`,
        points: -5,
      });
    }

    // L10 trend on the lineup's K% — has it been getting worse?
    const recentKs = opposingLineupSplits
      .map(s => s.recent_form?.k_pct)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (recentKs.length >= 4) {
      const avgRecentK = recentKs.reduce((a, b) => a + b, 0) / recentKs.length;
      const delta = avgRecentK - avgK;
      if (delta >= 2) {
        score += 5;
        rationale.push({
          label: `Opp lineup L10 K% +${delta.toFixed(1)}pp vs season (slumping)`,
          points: 5,
        });
      } else if (delta <= -2) {
        score -= 3;
        rationale.push({
          label: `Opp lineup L10 K% ${delta.toFixed(1)}pp (cutting down K's)`,
          points: -3,
        });
      }
    }
  }

  // 5. Odds sanity ----------------------------------------------------------
  let oddsMultiplier = 1;
  if (computed.overOdds != null) {
    if (computed.overOdds >= 150) {
      oddsMultiplier = 1.05;
      rationale.push({ label: `Plus-money Over (${computed.overOdds})`, points: 0 });
    } else if (computed.overOdds <= -180) {
      oddsMultiplier = 0.95;
      rationale.push({ label: `Heavy juice on Over (${computed.overOdds})`, points: 0 });
    }
  }

  return {
    score: Math.max(0, Math.min(100, score * oddsMultiplier)),
    computed,
    rationale,
    oddsMultiplier,
  };
}

// --------------------------------------------------------------------------
// PUBLIC ENTRY

interface BuildOptions {
  games: MatchupGame[];
  propsByGamePk: Map<number, MlbPlayerPropRow[]>;
  matchupByGamePk: Map<number, PitcherMatchupData>;
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
        // Which team is the batter on? Use lineup home/away to pick benchmarks
        // (vs OPPOSING pitcher hand = the hand stored on the matching split row).
        const split = splitsById.get(row.player_id);
        // Benchmark set should mirror split's vs_pitcher_hand.
        const benchmarks = split?.vs_pitcher_hand === 'L' ? benchmarksL : benchmarksR;
        const team =
          md?.awayLineupSplits.some(s => s.batter_id === row.player_id)
            ? game.away_team_name
            : md?.homeLineupSplits.some(s => s.batter_id === row.player_id)
              ? game.home_team_name
              : null;
        const result = scoreBatter(
          { row, game, team_name: team ?? '', split, benchmarks },
          line,
        );
        if (!result) continue;
        const tier = tierOf(result.score);
        if (!tier) continue;
        batterPicks.push({
          kind: 'batter',
          tier,
          emoji: emojiFor(tier),
          score: Math.round(result.score),
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
          over_odds: result.computed.overOdds,
          under_odds: result.computed.underOdds,
          l10_over: result.computed.l10.over,
          l10_games: result.computed.l10.games,
          l10_pct: result.computed.l10.pct,
          rationale: result.rationale,
        });
      } else {
        // Pitcher — figure out which lineup is opposing.
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
        const result = scorePitcher(
          {
            row,
            game,
            team_name: team,
            opposingLineupSplits,
            opposingLineup,
            benchmarks,
            pitcherBattedBall,
          },
          line,
        );
        if (!result) continue;
        const tier = tierOf(result.score);
        if (!tier) continue;
        pitcherPicks.push({
          kind: 'pitcher',
          tier,
          emoji: emojiFor(tier),
          score: Math.round(result.score),
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
          over_odds: result.computed.overOdds,
          under_odds: result.computed.underOdds,
          l10_over: result.computed.l10.over,
          l10_games: result.computed.l10.games,
          l10_pct: result.computed.l10.pct,
          rationale: result.rationale,
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
