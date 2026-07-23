/**
 * Shared active-chip builders for the NFL/CFB Lines & Odds group + the Systems tail
 * (Team Form → Opponent). Each returns { label, patch } where `patch` is the snapshot
 * merge that clears that dimension. Transcribed 1:1 from the retired pages' `chips` memo.
 */
import type { FootballShared, FootballBounds } from '../FootballRailShared';
import type { NflAsOfFilterSnapshot } from '@/features/analysis/normalizeSavedFilterSnapshot';
import type { ActiveChip } from './types';
import { rangeChanged, fmtMlOdds } from './shared';
import { windLabel } from '@/features/analysis/footballMarketLines';

function mlChip(
  label: string,
  min: string,
  max: string,
  patch: Record<string, unknown>,
): ActiveChip | null {
  if (min.trim() === '' && max.trim() === '') return null;
  const lbl =
    min.trim() !== '' && max.trim() !== ''
      ? `${label} ${fmtMlOdds(min)} to ${fmtMlOdds(max)}`
      : min.trim() !== ''
        ? `${label} ≥ ${fmtMlOdds(min)}`
        : `${label} ≤ ${fmtMlOdds(max)}`;
  return { label: lbl, patch };
}

/** Lines & Odds chips (spreads, totals, moneylines). */
export function footballLineChips(s: FootballShared, b: FootballBounds): ActiveChip[] {
  const c: ActiveChip[] = [];
  const spreadChip = (
    label: string,
    side: string,
    size: [number, number],
    max: number,
    sideKey: keyof FootballShared,
    sizeKey: keyof FootballShared,
  ) => {
    if (side !== 'any') {
      c.push({
        label: `${label} ${side === 'favorite' ? 'fav' : 'dog'} ${size[0]}–${size[1]}`,
        patch: { [sideKey]: 'any', [sizeKey]: [0, max] },
      });
    } else if (size[0] !== 0 || size[1] !== max) {
      c.push({ label: `${label} ${size[0]}–${size[1]}`, patch: { [sizeKey]: [0, max] } });
    }
  };
  spreadChip('FG spread', s.spreadSide, s.spreadSize, b.spreadMax, 'spreadSide', 'spreadSize');
  spreadChip('1H spread', s.h1SpreadSide, s.h1SpreadSize, b.h1SpreadMax, 'h1SpreadSide', 'h1SpreadSize');
  spreadChip('Opp FG spread', s.oppSpreadSide, s.oppSpreadSize, b.spreadMax, 'oppSpreadSide', 'oppSpreadSize');

  const total: [number, number] = [b.totalMin, b.totalMax];
  const tt: [number, number] = [b.ttMin, b.ttMax];
  const h1Total: [number, number] = [b.h1TotalMin, b.h1TotalMax];
  if (rangeChanged(s.lineRange, total))
    c.push({ label: `Game total ${s.lineRange[0]}–${s.lineRange[1]}`, patch: { lineRange: total } });
  if (rangeChanged(s.h1TotalRange, h1Total))
    c.push({ label: `1H total ${s.h1TotalRange[0]}–${s.h1TotalRange[1]}`, patch: { h1TotalRange: h1Total } });
  if (rangeChanged(s.ttLineRange, tt))
    c.push({ label: `TT ${s.ttLineRange[0]}–${s.ttLineRange[1]}`, patch: { ttLineRange: tt } });
  if (rangeChanged(s.oppTtLineRange, tt))
    c.push({ label: `Opp TT ${s.oppTtLineRange[0]}–${s.oppTtLineRange[1]}`, patch: { oppTtLineRange: tt } });

  const ml1 = mlChip('ML', s.mlMin, s.mlMax, { mlMin: '', mlMax: '' });
  if (ml1) c.push(ml1);
  const ml2 = mlChip('1H ML', s.h1MlMin, s.h1MlMax, { h1MlMin: '', h1MlMax: '' });
  if (ml2) c.push(ml2);
  const ml3 = mlChip('Opp ML', s.oppMlMin, s.oppMlMax, { oppMlMin: '', oppMlMax: '' });
  if (ml3) c.push(ml3);
  return c;
}

/** Last game + Opponent last game chips. */
export function footballLastGameChips(s: FootballShared, margin: [number, number]): ActiveChip[] {
  const c: ActiveChip[] = [];
  if (s.lastResult !== 'any') c.push({ label: `Last game: ${s.lastResult === 'won' ? 'Won' : 'Lost'}`, patch: { lastResult: 'any' } });
  if (s.lastAts !== 'any') c.push({ label: `Last game: ${s.lastAts === 'covered' ? 'Covered' : "Didn't cover"}`, patch: { lastAts: 'any' } });
  if (s.lastTotal !== 'any') c.push({ label: `Last game: ${s.lastTotal === 'over' ? 'Over' : 'Under'}`, patch: { lastTotal: 'any' } });
  if (s.lastRole !== 'any') c.push({ label: `Last game: ${s.lastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, patch: { lastRole: 'any' } });
  if (s.lastOt !== null) c.push({ label: `Last game OT: ${s.lastOt ? 'Yes' : 'No'}`, patch: { lastOt: null } });
  if (rangeChanged(s.lastMargin, margin)) c.push({ label: `Last game margin ${s.lastMargin[0]} to ${s.lastMargin[1]}`, patch: { lastMargin: margin } });
  if (s.oppLastResult !== 'any') c.push({ label: `Opp last game: ${s.oppLastResult === 'won' ? 'Won' : 'Lost'}`, patch: { oppLastResult: 'any' } });
  if (s.oppLastAts !== 'any') c.push({ label: `Opp last game: ${s.oppLastAts === 'covered' ? 'Covered' : "Didn't cover"}`, patch: { oppLastAts: 'any' } });
  if (s.oppLastTotal !== 'any') c.push({ label: `Opp last game: ${s.oppLastTotal === 'over' ? 'Over' : 'Under'}`, patch: { oppLastTotal: 'any' } });
  if (s.oppLastRole !== 'any') c.push({ label: `Opp last game: ${s.oppLastRole === 'favorite' ? 'Favorite' : 'Underdog'}`, patch: { oppLastRole: 'any' } });
  if (s.oppLastOt !== null) c.push({ label: `Opp last game OT: ${s.oppLastOt ? 'Yes' : 'No'}`, patch: { oppLastOt: null } });
  if (rangeChanged(s.oppLastMargin, margin)) c.push({ label: `Opp last game margin ${s.oppLastMargin[0]} to ${s.oppLastMargin[1]}`, patch: { oppLastMargin: margin } });
  return c;
}

/** Season Record → Opponent Record (as-of Systems) chips. */
export function footballAsOfChips(s: FootballShared, D: NflAsOfFilterSnapshot): ActiveChip[] {
  const c: ActiveChip[] = [];
  if (rangeChanged(s.winPct, D.winPct)) c.push({ label: `Win% ${s.winPct[0]}–${s.winPct[1]}`, patch: { winPct: D.winPct } });
  if (rangeChanged(s.winStreak, D.winStreak)) c.push({ label: `Win streak ${s.winStreak[0]}–${s.winStreak[1]}`, patch: { winStreak: D.winStreak } });
  if (rangeChanged(s.lossStreak, D.lossStreak)) c.push({ label: `Loss streak ${s.lossStreak[0]}–${s.lossStreak[1]}`, patch: { lossStreak: D.lossStreak } });
  if (s.above500 !== null) c.push({ label: s.above500 ? 'Winning record' : 'Losing / .500', patch: { above500: null } });
  if (s.winPctGtOpp !== null) c.push({ label: s.winPctGtOpp ? 'Win% > opp' : 'Win% ≤ opp', patch: { winPctGtOpp: null } });
  if (rangeChanged(s.ppg, D.ppg)) c.push({ label: `PPG ${s.ppg[0]}–${s.ppg[1]}`, patch: { ppg: D.ppg } });
  if (rangeChanged(s.paPg, D.paPg)) c.push({ label: `PA/g ${s.paPg[0]}–${s.paPg[1]}`, patch: { paPg: D.paPg } });
  if (rangeChanged(s.pointDiffPg, D.pointDiffPg)) c.push({ label: `Pt diff ${s.pointDiffPg[0]}–${s.pointDiffPg[1]}`, patch: { pointDiffPg: D.pointDiffPg } });
  if (s.minGames > 0) c.push({ label: `Min ${s.minGames} games`, patch: { minGames: 0 } });
  if (rangeChanged(s.atsWinPct, D.atsWinPct)) c.push({ label: `ATS% ${s.atsWinPct[0]}–${s.atsWinPct[1]}`, patch: { atsWinPct: D.atsWinPct } });
  if (rangeChanged(s.atsWinStreak, D.atsWinStreak)) c.push({ label: `ATS streak ${s.atsWinStreak[0]}–${s.atsWinStreak[1]}`, patch: { atsWinStreak: D.atsWinStreak } });
  if (rangeChanged(s.avgCoverMargin, D.avgCoverMargin)) c.push({ label: `Cover margin ${s.avgCoverMargin[0]}–${s.avgCoverMargin[1]}`, patch: { avgCoverMargin: D.avgCoverMargin } });
  if (rangeChanged(s.overPct, D.overPct)) c.push({ label: `Over% ${s.overPct[0]}–${s.overPct[1]}`, patch: { overPct: D.overPct } });
  if (rangeChanged(s.overStreak, D.overStreak)) c.push({ label: `Over streak ${s.overStreak[0]}–${s.overStreak[1]}`, patch: { overStreak: D.overStreak } });
  if (rangeChanged(s.underStreak, D.underStreak)) c.push({ label: `Under streak ${s.underStreak[0]}–${s.underStreak[1]}`, patch: { underStreak: D.underStreak } });
  if (rangeChanged(s.prevWins, D.prevWins)) c.push({ label: `Prev wins ${s.prevWins[0]}–${s.prevWins[1]}`, patch: { prevWins: D.prevWins } });
  if (rangeChanged(s.prevWinPct, D.prevWinPct)) c.push({ label: `Prev win% ${s.prevWinPct[0]}–${s.prevWinPct[1]}`, patch: { prevWinPct: D.prevWinPct } });
  if (s.madePlayoffsPrev !== null) c.push({ label: s.madePlayoffsPrev ? 'Made playoffs last yr' : 'Missed playoffs last yr', patch: { madePlayoffsPrev: null } });
  if (s.moreWinsThanOppPrev !== null) c.push({ label: s.moreWinsThanOppPrev ? 'More wins than opp last yr' : '≤ opp wins last yr', patch: { moreWinsThanOppPrev: null } });
  if (s.h2hLastWin !== 'any') c.push({ label: `H2H: ${s.h2hLastWin === 'yes' ? 'Won last' : 'Lost last'}`, patch: { h2hLastWin: 'any' } });
  if (s.h2hLastAts !== 'any') c.push({ label: `H2H: ${s.h2hLastAts === 'yes' ? 'Covered last' : "Didn't cover last"}`, patch: { h2hLastAts: 'any' } });
  if (s.h2hLastOver !== 'any') c.push({ label: `H2H: ${s.h2hLastOver === 'yes' ? 'Over last' : 'Under last'}`, patch: { h2hLastOver: 'any' } });
  if (s.h2hLastHome !== null) c.push({ label: `H2H home: ${s.h2hLastHome ? 'Yes' : 'No'}`, patch: { h2hLastHome: null } });
  if (s.h2hLastFav !== null) c.push({ label: `H2H fav: ${s.h2hLastFav ? 'Yes' : 'No'}`, patch: { h2hLastFav: null } });
  if (s.h2hSameSeason !== null) c.push({ label: `H2H same season: ${s.h2hSameSeason ? 'Yes' : 'No'}`, patch: { h2hSameSeason: null } });
  if (s.h2hSpreadCmp !== 'any') c.push({ label: s.h2hSpreadCmp === 'lower' ? 'Spread lower vs H2H' : 'Spread higher vs H2H', patch: { h2hSpreadCmp: 'any' } });
  if (rangeChanged(s.oppWinPct, D.oppWinPct)) c.push({ label: `Opp win% ${s.oppWinPct[0]}–${s.oppWinPct[1]}`, patch: { oppWinPct: D.oppWinPct } });
  if (rangeChanged(s.oppOverPct, D.oppOverPct)) c.push({ label: `Opp over% ${s.oppOverPct[0]}–${s.oppOverPct[1]}`, patch: { oppOverPct: D.oppOverPct } });
  if (rangeChanged(s.oppWinStreak, D.oppWinStreak)) c.push({ label: `Opp win streak ${s.oppWinStreak[0]}–${s.oppWinStreak[1]}`, patch: { oppWinStreak: D.oppWinStreak } });
  if (rangeChanged(s.oppLossStreak, D.oppLossStreak)) c.push({ label: `Opp loss streak ${s.oppLossStreak[0]}–${s.oppLossStreak[1]}`, patch: { oppLossStreak: D.oppLossStreak } });
  if (rangeChanged(s.oppPpg, D.oppPpg)) c.push({ label: `Opp PPG ${s.oppPpg[0]}–${s.oppPpg[1]}`, patch: { oppPpg: D.oppPpg } });
  if (rangeChanged(s.oppPaPg, D.oppPaPg)) c.push({ label: `Opp PA/G ${s.oppPaPg[0]}–${s.oppPaPg[1]}`, patch: { oppPaPg: D.oppPaPg } });
  if (rangeChanged(s.oppPrevWinPct, D.oppPrevWinPct)) c.push({ label: `Opp prev win% ${s.oppPrevWinPct[0]}–${s.oppPrevWinPct[1]}`, patch: { oppPrevWinPct: D.oppPrevWinPct } });
  return c;
}

export { windLabel };
