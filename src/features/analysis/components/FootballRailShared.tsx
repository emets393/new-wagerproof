import * as React from 'react';
import { RangeRow, ScalarRow, SelectRow, TriRow, MlOddsRow, FilterGroup } from './FilterControls';
import type { SpreadSide } from '@/features/analysis/footballMarketLines';

/**
 * NFL and CFB rails share the "Lines & odds" group and the entire Systems tail (Last game →
 * Opponent Record). Only the bounds + a CFB moneyline note differ, so both live here once —
 * the two football adapters pass their bounds. Keeps the two rails from drifting apart.
 */
export interface FootballBounds {
  spreadMax: number;
  h1SpreadMax: number;
  totalMin: number;
  totalMax: number;
  ttMin: number;
  ttMax: number;
  h1TotalMin: number;
  h1TotalMax: number;
  marginBounds: [number, number];
  ppgMax: number;
  paPgMax: number;
  pointDiffAbs: number;
  avgCoverAbs: number;
  prevWinsMax: number;
  oppPpgMax: number;
  oppPaPgMax: number;
  mlNote?: string;
}

/** The shared football snapshot fields (present on both Nfl/CfbWebFilterSnapshot). */
export interface FootballShared {
  spreadSide: string;
  spreadSize: [number, number];
  lineRange: [number, number];
  mlMin: string;
  mlMax: string;
  ttLineRange: [number, number];
  h1SpreadSide: string;
  h1SpreadSize: [number, number];
  h1MlMin: string;
  h1MlMax: string;
  h1TotalRange: [number, number];
  oppSpreadSide: string;
  oppSpreadSize: [number, number];
  oppMlMin: string;
  oppMlMax: string;
  oppTtLineRange: [number, number];
  lastResult: string;
  lastAts: string;
  lastTotal: string;
  lastRole: string;
  lastOt: boolean | null;
  lastMargin: [number, number];
  oppLastResult: string;
  oppLastAts: string;
  oppLastTotal: string;
  oppLastRole: string;
  oppLastOt: boolean | null;
  oppLastMargin: [number, number];
  winPct: [number, number];
  winStreak: [number, number];
  lossStreak: [number, number];
  above500: boolean | null;
  winPctGtOpp: boolean | null;
  ppg: [number, number];
  paPg: [number, number];
  pointDiffPg: [number, number];
  minGames: number;
  atsWinPct: [number, number];
  atsWinStreak: [number, number];
  avgCoverMargin: [number, number];
  overPct: [number, number];
  overStreak: [number, number];
  underStreak: [number, number];
  prevWins: [number, number];
  prevWinPct: [number, number];
  madePlayoffsPrev: boolean | null;
  moreWinsThanOppPrev: boolean | null;
  h2hLastWin: string;
  h2hLastAts: string;
  h2hLastOver: string;
  h2hLastHome: boolean | null;
  h2hLastFav: boolean | null;
  h2hSameSeason: boolean | null;
  h2hSpreadCmp: string;
  oppWinPct: [number, number];
  oppOverPct: [number, number];
  oppWinStreak: [number, number];
  oppLossStreak: [number, number];
  oppPpg: [number, number];
  oppPaPg: [number, number];
  oppPrevWinPct: [number, number];
}

type Update = (patch: Partial<FootballShared>) => void;

/**
 * Snapshot keys per shared football FilterGroup title — feeds the drawer's per-section
 * active-count badges. Must stay in sync with the groups rendered below.
 */
export const FOOTBALL_SHARED_GROUP_FIELDS: Record<string, readonly string[]> = {
  'Lines & odds': [
    'spreadSide', 'spreadSize', 'lineRange', 'mlMin', 'mlMax', 'ttLineRange',
    'h1SpreadSide', 'h1SpreadSize', 'h1MlMin', 'h1MlMax', 'h1TotalRange',
    'oppSpreadSide', 'oppSpreadSize', 'oppMlMin', 'oppMlMax', 'oppTtLineRange',
  ],
  'Last game': ['lastResult', 'lastAts', 'lastTotal', 'lastRole', 'lastOt', 'lastMargin'],
  'Opponent last game': ['oppLastResult', 'oppLastAts', 'oppLastTotal', 'oppLastRole', 'oppLastOt', 'oppLastMargin'],
  'Season Record': ['winPct', 'winStreak', 'lossStreak', 'above500', 'winPctGtOpp', 'ppg', 'paPg', 'pointDiffPg', 'minGames'],
  'Cover Profile': ['atsWinPct', 'atsWinStreak', 'avgCoverMargin'],
  'Total Profile': ['overPct', 'overStreak', 'underStreak'],
  'Prior Year': ['prevWins', 'prevWinPct', 'madePlayoffsPrev', 'moreWinsThanOppPrev'],
  'Head-to-Head': ['h2hLastWin', 'h2hLastAts', 'h2hLastOver', 'h2hLastHome', 'h2hLastFav', 'h2hSameSeason', 'h2hSpreadCmp'],
  'Opponent Record': ['oppWinPct', 'oppOverPct', 'oppWinStreak', 'oppLossStreak', 'oppPpg', 'oppPaPg', 'oppPrevWinPct'],
};

const SPREAD_OPTS: [string, string][] = [
  ['any', 'Either side'],
  ['favorite', 'Favored by'],
  ['underdog', 'Getting'],
];

export function FootballLinesGroup({
  s,
  update,
  b,
}: {
  s: FootballShared;
  update: Update;
  b: FootballBounds;
}) {
  return (
    <FilterGroup title="Lines & odds" defaultOpen>
      <div className="-mt-1 text-[11px] text-muted-foreground">
        Independent of the result market above — filter the sample by any posted line.
      </div>
      <SelectRow
        label="FG spread (team)"
        value={s.spreadSide}
        onChange={(v) => update({ spreadSide: v as SpreadSide })}
        options={SPREAD_OPTS}
      />
      <RangeRow
        label={`${s.spreadSide === 'favorite' ? 'Favored by' : s.spreadSide === 'underdog' ? 'Getting' : 'FG spread'}: ${s.spreadSize[0]}–${s.spreadSize[1]} pts`}
        min={0}
        max={b.spreadMax}
        step={0.5}
        value={s.spreadSize}
        onChange={(v) => update({ spreadSize: v })}
      />
      <MlOddsRow
        label="FG moneyline (team, American)"
        min={s.mlMin}
        max={s.mlMax}
        onMin={(v) => update({ mlMin: v })}
        onMax={(v) => update({ mlMax: v })}
        hint={b.mlNote}
      />
      <RangeRow
        label={`Game total: ${s.lineRange[0]}–${s.lineRange[1]}`}
        min={b.totalMin}
        max={b.totalMax}
        step={0.5}
        value={s.lineRange}
        onChange={(v) => update({ lineRange: v })}
      />
      <RangeRow
        label={`Team total line: ${s.ttLineRange[0]}–${s.ttLineRange[1]}`}
        min={b.ttMin}
        max={b.ttMax}
        step={0.5}
        value={s.ttLineRange}
        onChange={(v) => update({ ttLineRange: v })}
      />
      <SelectRow
        label="1H spread (team)"
        value={s.h1SpreadSide}
        onChange={(v) => update({ h1SpreadSide: v as SpreadSide })}
        options={SPREAD_OPTS}
      />
      <RangeRow
        label={`${s.h1SpreadSide === 'favorite' ? '1H favored by' : s.h1SpreadSide === 'underdog' ? '1H getting' : '1H spread'}: ${s.h1SpreadSize[0]}–${s.h1SpreadSize[1]} pts`}
        min={0}
        max={b.h1SpreadMax}
        step={0.5}
        value={s.h1SpreadSize}
        onChange={(v) => update({ h1SpreadSize: v })}
      />
      <MlOddsRow
        label="1H moneyline (team, American)"
        min={s.h1MlMin}
        max={s.h1MlMax}
        onMin={(v) => update({ h1MlMin: v })}
        onMax={(v) => update({ h1MlMax: v })}
      />
      <RangeRow
        label={`1H total: ${s.h1TotalRange[0]}–${s.h1TotalRange[1]}`}
        min={b.h1TotalMin}
        max={b.h1TotalMax}
        step={0.5}
        value={s.h1TotalRange}
        onChange={(v) => update({ h1TotalRange: v })}
      />
      <SelectRow
        label="FG spread (opponent)"
        value={s.oppSpreadSide}
        onChange={(v) => update({ oppSpreadSide: v as SpreadSide })}
        options={SPREAD_OPTS}
      />
      <RangeRow
        label={`${s.oppSpreadSide === 'favorite' ? 'Opp favored by' : s.oppSpreadSide === 'underdog' ? 'Opp getting' : 'Opp FG spread'}: ${s.oppSpreadSize[0]}–${s.oppSpreadSize[1]} pts`}
        min={0}
        max={b.spreadMax}
        step={0.5}
        value={s.oppSpreadSize}
        onChange={(v) => update({ oppSpreadSize: v })}
      />
      <MlOddsRow
        label="FG moneyline (opponent, American)"
        min={s.oppMlMin}
        max={s.oppMlMax}
        onMin={(v) => update({ oppMlMin: v })}
        onMax={(v) => update({ oppMlMax: v })}
      />
      <RangeRow
        label={`Opp team total: ${s.oppTtLineRange[0]}–${s.oppTtLineRange[1]}`}
        min={b.ttMin}
        max={b.ttMax}
        step={0.5}
        value={s.oppTtLineRange}
        onChange={(v) => update({ oppTtLineRange: v })}
      />
    </FilterGroup>
  );
}

const RESULT_OPTS: [string, string][] = [
  ['any', 'Any'],
  ['won', 'Won'],
  ['lost', 'Lost'],
];
const ATS_OPTS: [string, string][] = [
  ['any', 'Any'],
  ['covered', 'Covered'],
  ['not', "Didn't cover"],
];
const TOTAL_OPTS: [string, string][] = [
  ['any', 'Any'],
  ['over', 'Over'],
  ['under', 'Under'],
];
const ROLE_OPTS: [string, string][] = [
  ['any', 'Any'],
  ['favorite', 'Favorite'],
  ['underdog', 'Underdog'],
];

/** Last game → Opponent Record (identical structure in NFL & CFB). */
export function FootballTailGroups({
  s,
  update,
  b,
}: {
  s: FootballShared;
  update: Update;
  b: FootballBounds;
}) {
  return (
    <>
      <FilterGroup title="Last game">
        <SelectRow label="Result" value={s.lastResult} onChange={(v) => update({ lastResult: v })} options={RESULT_OPTS} />
        <SelectRow label="ATS" value={s.lastAts} onChange={(v) => update({ lastAts: v })} options={ATS_OPTS} />
        <SelectRow label="Total" value={s.lastTotal} onChange={(v) => update({ lastTotal: v })} options={TOTAL_OPTS} />
        <SelectRow label="Was" value={s.lastRole} onChange={(v) => update({ lastRole: v })} options={ROLE_OPTS} />
        <RangeRow
          label={`Last game margin: ${s.lastMargin[0]} to ${s.lastMargin[1]} pts (+ = won by, − = lost by)`}
          min={b.marginBounds[0]}
          max={b.marginBounds[1]}
          step={1}
          value={s.lastMargin}
          onChange={(v) => update({ lastMargin: v })}
        />
        <TriRow label="Went to overtime" value={s.lastOt} onChange={(v) => update({ lastOt: v })} />
      </FilterGroup>

      <FilterGroup title="Opponent last game">
        <SelectRow label="Result" value={s.oppLastResult} onChange={(v) => update({ oppLastResult: v })} options={RESULT_OPTS} />
        <SelectRow label="ATS" value={s.oppLastAts} onChange={(v) => update({ oppLastAts: v })} options={ATS_OPTS} />
        <SelectRow label="Total" value={s.oppLastTotal} onChange={(v) => update({ oppLastTotal: v })} options={TOTAL_OPTS} />
        <SelectRow label="Was" value={s.oppLastRole} onChange={(v) => update({ oppLastRole: v })} options={ROLE_OPTS} />
        <RangeRow
          label={`Opponent last game margin: ${s.oppLastMargin[0]} to ${s.oppLastMargin[1]} pts (+ = won by, − = lost by)`}
          min={b.marginBounds[0]}
          max={b.marginBounds[1]}
          step={1}
          value={s.oppLastMargin}
          onChange={(v) => update({ oppLastMargin: v })}
        />
        <TriRow label="Went to overtime" value={s.oppLastOt} onChange={(v) => update({ oppLastOt: v })} />
      </FilterGroup>

      <FilterGroup title="Season Record">
        <RangeRow label={`Win%: ${s.winPct[0]}–${s.winPct[1]}%`} min={0} max={100} step={1} value={s.winPct} onChange={(v) => update({ winPct: v })} />
        <RangeRow label={`Win streak: ${s.winStreak[0]}–${s.winStreak[1]}`} min={0} max={16} step={1} value={s.winStreak} onChange={(v) => update({ winStreak: v })} />
        <RangeRow label={`Loss streak: ${s.lossStreak[0]}–${s.lossStreak[1]}`} min={0} max={16} step={1} value={s.lossStreak} onChange={(v) => update({ lossStreak: v })} />
        <TriRow label="Winning record (>.500)" value={s.above500} onChange={(v) => update({ above500: v })} />
        <TriRow label="Win% better than opponent" value={s.winPctGtOpp} onChange={(v) => update({ winPctGtOpp: v })} />
        <RangeRow label={`PPG: ${s.ppg[0]}–${s.ppg[1]}`} min={0} max={b.ppgMax} step={0.5} value={s.ppg} onChange={(v) => update({ ppg: v })} />
        <RangeRow label={`PA/g: ${s.paPg[0]}–${s.paPg[1]}`} min={0} max={b.paPgMax} step={0.5} value={s.paPg} onChange={(v) => update({ paPg: v })} />
        <RangeRow label={`Point diff/g: ${s.pointDiffPg[0]}–${s.pointDiffPg[1]}`} min={-b.pointDiffAbs} max={b.pointDiffAbs} step={0.5} value={s.pointDiffPg} onChange={(v) => update({ pointDiffPg: v })} />
        <ScalarRow label={`Min games this season: ${s.minGames === 0 ? 'Any' : s.minGames}`} min={0} max={10} step={1} value={s.minGames} onChange={(v) => update({ minGames: v })} />
      </FilterGroup>

      <FilterGroup title="Cover Profile">
        <RangeRow label={`ATS win%: ${s.atsWinPct[0]}–${s.atsWinPct[1]}%`} min={0} max={100} step={1} value={s.atsWinPct} onChange={(v) => update({ atsWinPct: v })} />
        <RangeRow label={`ATS win streak: ${s.atsWinStreak[0]}–${s.atsWinStreak[1]}`} min={0} max={16} step={1} value={s.atsWinStreak} onChange={(v) => update({ atsWinStreak: v })} />
        <RangeRow label={`Avg cover margin: ${s.avgCoverMargin[0]}–${s.avgCoverMargin[1]}`} min={-b.avgCoverAbs} max={b.avgCoverAbs} step={0.5} value={s.avgCoverMargin} onChange={(v) => update({ avgCoverMargin: v })} />
      </FilterGroup>

      <FilterGroup title="Total Profile">
        <RangeRow label={`Over%: ${s.overPct[0]}–${s.overPct[1]}%`} min={0} max={100} step={1} value={s.overPct} onChange={(v) => update({ overPct: v })} />
        <RangeRow label={`Over streak: ${s.overStreak[0]}–${s.overStreak[1]}`} min={0} max={16} step={1} value={s.overStreak} onChange={(v) => update({ overStreak: v })} />
        <RangeRow label={`Under streak: ${s.underStreak[0]}–${s.underStreak[1]}`} min={0} max={16} step={1} value={s.underStreak} onChange={(v) => update({ underStreak: v })} />
      </FilterGroup>

      <FilterGroup title="Prior Year">
        <RangeRow label={`Last season wins: ${s.prevWins[0]}–${s.prevWins[1]}`} min={0} max={b.prevWinsMax} step={1} value={s.prevWins} onChange={(v) => update({ prevWins: v })} />
        <RangeRow label={`Last season win%: ${s.prevWinPct[0]}–${s.prevWinPct[1]}%`} min={0} max={100} step={1} value={s.prevWinPct} onChange={(v) => update({ prevWinPct: v })} />
        <TriRow label="Made playoffs last year" value={s.madePlayoffsPrev} onChange={(v) => update({ madePlayoffsPrev: v })} />
        <TriRow label="More wins than opponent last year" value={s.moreWinsThanOppPrev} onChange={(v) => update({ moreWinsThanOppPrev: v })} />
      </FilterGroup>

      <FilterGroup title="Head-to-Head">
        <SelectRow label="Won last meeting" value={s.h2hLastWin} onChange={(v) => update({ h2hLastWin: v })} options={[['any', 'Any'], ['yes', 'Won'], ['no', 'Lost']]} />
        <SelectRow label="Covered last meeting" value={s.h2hLastAts} onChange={(v) => update({ h2hLastAts: v })} options={[['any', 'Any'], ['yes', 'Covered'], ['no', "Didn't cover"]]} />
        <SelectRow label="Last meeting total" value={s.h2hLastOver} onChange={(v) => update({ h2hLastOver: v })} options={[['any', 'Any'], ['yes', 'Over'], ['no', 'Under']]} />
        <TriRow label="Was home last meeting" value={s.h2hLastHome} onChange={(v) => update({ h2hLastHome: v })} />
        <TriRow label="Was favorite last meeting" value={s.h2hLastFav} onChange={(v) => update({ h2hLastFav: v })} />
        <TriRow label="Same season as last meeting" value={s.h2hSameSeason} onChange={(v) => update({ h2hSameSeason: v })} />
        <SelectRow
          label="Spread vs last meeting"
          value={s.h2hSpreadCmp}
          onChange={(v) => update({ h2hSpreadCmp: v })}
          options={[['any', 'Any'], ['lower', 'Lower (more favored / less pts)'], ['higher', 'Higher (less favored / more pts)']]}
        />
      </FilterGroup>

      <FilterGroup title="Opponent Record">
        <RangeRow label={`Opp win%: ${s.oppWinPct[0]}–${s.oppWinPct[1]}%`} min={0} max={100} step={1} value={s.oppWinPct} onChange={(v) => update({ oppWinPct: v })} />
        <RangeRow label={`Opp over%: ${s.oppOverPct[0]}–${s.oppOverPct[1]}%`} min={0} max={100} step={1} value={s.oppOverPct} onChange={(v) => update({ oppOverPct: v })} />
        <RangeRow label={`Opp win streak: ${s.oppWinStreak[0]}–${s.oppWinStreak[1]}`} min={0} max={16} step={1} value={s.oppWinStreak} onChange={(v) => update({ oppWinStreak: v })} />
        <RangeRow label={`Opp loss streak: ${s.oppLossStreak[0]}–${s.oppLossStreak[1]}`} min={0} max={16} step={1} value={s.oppLossStreak} onChange={(v) => update({ oppLossStreak: v })} />
        <RangeRow label={`Opp PPG: ${s.oppPpg[0]}–${s.oppPpg[1]}`} min={0} max={b.oppPpgMax} step={0.5} value={s.oppPpg} onChange={(v) => update({ oppPpg: v })} />
        <RangeRow label={`Opp PA/G: ${s.oppPaPg[0]}–${s.oppPaPg[1]}`} min={0} max={b.oppPaPgMax} step={0.5} value={s.oppPaPg} onChange={(v) => update({ oppPaPg: v })} />
        <RangeRow label={`Opp prev win%: ${s.oppPrevWinPct[0]}–${s.oppPrevWinPct[1]}%`} min={0} max={100} step={1} value={s.oppPrevWinPct} onChange={(v) => update({ oppPrevWinPct: v })} />
      </FilterGroup>
    </>
  );
}
