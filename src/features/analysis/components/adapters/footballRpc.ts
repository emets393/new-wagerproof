/**
 * Shared p_filters emission for the NFL/CFB Lines & Odds, Last game, and Systems (as-of) blocks.
 * Transcribed verbatim from both pages' `buildFilters` — the blocks were byte-identical apart from
 * the market-line config + margin bounds, which are passed in.
 */
import type { FootballShared } from '../FootballRailShared';
import type { NflAsOfFilterSnapshot } from '@/features/analysis/normalizeSavedFilterSnapshot';
import {
  emitSpreadLine,
  emitTotalLine,
  emitMlOdds,
  type SpreadLineCfg,
  type TotalLineCfg,
  type SpreadSide,
} from '@/features/analysis/footballMarketLines';
import { applyNumRange, applyPctRange } from './shared';

export interface FootballLineCfgs {
  fgSpread: SpreadLineCfg;
  h1Spread: SpreadLineCfg;
  fgTotal: TotalLineCfg;
  h1Total: TotalLineCfg;
  ttLine: TotalLineCfg;
}

export function emitFootballLines(
  f: Record<string, unknown>,
  s: FootballShared,
  cfg: FootballLineCfgs,
): void {
  emitSpreadLine(f, s.spreadSide as SpreadSide, s.spreadSize, cfg.fgSpread);
  emitSpreadLine(f, s.h1SpreadSide as SpreadSide, s.h1SpreadSize, cfg.h1Spread);
  emitSpreadLine(f, s.oppSpreadSide as SpreadSide, s.oppSpreadSize, cfg.fgSpread, { invert: true });
  emitMlOdds(f, s.mlMin, s.mlMax);
  emitMlOdds(f, s.h1MlMin, s.h1MlMax, { min: 'h1_ml_min', max: 'h1_ml_max' });
  emitMlOdds(f, s.oppMlMin, s.oppMlMax, { min: 'opp_ml_min', max: 'opp_ml_max' });
  emitTotalLine(f, s.lineRange, cfg.fgTotal);
  emitTotalLine(f, s.h1TotalRange, cfg.h1Total);
  emitTotalLine(f, s.ttLineRange, cfg.ttLine);
  emitTotalLine(f, s.oppTtLineRange, { ...cfg.ttLine, mk: 'opp_tt_min', xk: 'opp_tt_max' });
}

export function emitFootballLastGame(
  f: Record<string, unknown>,
  s: FootballShared,
  margin: [number, number],
): void {
  if (s.lastResult !== 'any') f.last_won = s.lastResult === 'won' ? 1 : 0;
  if (s.lastAts !== 'any') f.last_covered = s.lastAts === 'covered' ? 1 : 0;
  if (s.lastTotal !== 'any') f.last_over = s.lastTotal === 'over' ? 1 : 0;
  if (s.lastRole !== 'any') f.last_favorite = s.lastRole === 'favorite';
  if (s.lastOt !== null) f.last_overtime = s.lastOt;
  applyNumRange(f, 'last_margin', s.lastMargin, margin);
  if (s.oppLastResult !== 'any') f.opp_last_won = s.oppLastResult === 'won' ? 1 : 0;
  if (s.oppLastAts !== 'any') f.opp_last_covered = s.oppLastAts === 'covered' ? 1 : 0;
  if (s.oppLastTotal !== 'any') f.opp_last_over = s.oppLastTotal === 'over' ? 1 : 0;
  if (s.oppLastRole !== 'any') f.opp_last_favorite = s.oppLastRole === 'favorite';
  if (s.oppLastOt !== null) f.opp_last_overtime = s.oppLastOt;
  applyNumRange(f, 'opp_last_margin', s.oppLastMargin, margin);
}

export function emitFootballAsOf(
  f: Record<string, unknown>,
  s: FootballShared,
  D: NflAsOfFilterSnapshot,
): void {
  applyPctRange(f, 'win_pct', s.winPct);
  applyNumRange(f, 'win_streak', s.winStreak, D.winStreak);
  applyNumRange(f, 'loss_streak', s.lossStreak, D.lossStreak);
  if (s.above500 !== null) f.above_500 = s.above500;
  if (s.winPctGtOpp !== null) f.win_pct_gt_opp = s.winPctGtOpp;
  applyNumRange(f, 'ppg', s.ppg, D.ppg);
  applyNumRange(f, 'pa_pg', s.paPg, D.paPg);
  applyNumRange(f, 'point_diff_pg', s.pointDiffPg, D.pointDiffPg);
  if (s.minGames > 0) f.min_games = s.minGames;
  applyPctRange(f, 'ats_win_pct', s.atsWinPct);
  applyNumRange(f, 'ats_win_streak', s.atsWinStreak, D.atsWinStreak);
  applyNumRange(f, 'avg_cover_margin', s.avgCoverMargin, D.avgCoverMargin);
  applyPctRange(f, 'over_pct', s.overPct);
  applyNumRange(f, 'over_streak', s.overStreak, D.overStreak);
  applyNumRange(f, 'under_streak', s.underStreak, D.underStreak);
  applyNumRange(f, 'prev_wins', s.prevWins, D.prevWins);
  applyPctRange(f, 'prev_win_pct', s.prevWinPct);
  if (s.madePlayoffsPrev !== null) f.made_playoffs_prev = s.madePlayoffsPrev;
  if (s.moreWinsThanOppPrev !== null) f.more_wins_than_opp_prev = s.moreWinsThanOppPrev;
  if (s.h2hLastWin !== 'any') f.h2h_last_win = s.h2hLastWin === 'yes' ? 1 : 0;
  if (s.h2hLastAts !== 'any') f.h2h_last_ats_win = s.h2hLastAts === 'yes' ? 1 : 0;
  if (s.h2hLastOver !== 'any') f.h2h_last_over = s.h2hLastOver === 'yes' ? 1 : 0;
  if (s.h2hLastHome !== null) f.h2h_last_home = s.h2hLastHome;
  if (s.h2hLastFav !== null) f.h2h_last_fav = s.h2hLastFav;
  if (s.h2hSameSeason !== null) f.h2h_same_season = s.h2hSameSeason;
  if (s.h2hSpreadCmp === 'lower') f.h2h_spread_lower = true;
  else if (s.h2hSpreadCmp === 'higher') f.h2h_spread_higher = true;
  applyPctRange(f, 'opp_win_pct', s.oppWinPct);
  applyPctRange(f, 'opp_over_pct', s.oppOverPct);
  applyNumRange(f, 'opp_win_streak', s.oppWinStreak, D.oppWinStreak);
  applyNumRange(f, 'opp_loss_streak', s.oppLossStreak, D.oppLossStreak);
  applyNumRange(f, 'opp_ppg', s.oppPpg, D.oppPpg);
  applyNumRange(f, 'opp_pa_pg', s.oppPaPg, D.oppPaPg);
  applyPctRange(f, 'opp_prev_win_pct', s.oppPrevWinPct);
}
