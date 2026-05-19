import type {
  BatterHand,
  BatterSplitRow,
  LineupRow,
  PitcherArsenalByHand,
  PitcherArsenalRow,
  PitchHand,
} from '@/types/mlb-matchups';

/** Map DB / legacy values to A (overall), R (vs RHB), L (vs LHB). */
export function normalizeVsBatterHand(raw: string | null | undefined): BatterHand {
  const h = String(raw ?? 'A')
    .trim()
    .toUpperCase();
  if (h === 'R' || h === 'RHB' || h === 'RH' || h === 'RIGHT') return 'R';
  if (h === 'L' || h === 'LHB' || h === 'LH' || h === 'LEFT') return 'L';
  if (h === 'A' || h === 'ALL' || h === 'O' || h === 'OVERALL' || h === '') return 'A';
  return 'A';
}

function dedupeByPitchType(rows: PitcherArsenalRow[]): PitcherArsenalRow[] {
  const byType = new Map<string, PitcherArsenalRow>();
  for (const row of rows) {
    const prev = byType.get(row.pitch_type);
    if (!prev || (row.pitches_thrown ?? 0) > (prev.pitches_thrown ?? 0)) {
      byType.set(row.pitch_type, row);
    }
  }
  return [...byType.values()];
}

export function groupArsenalByHand(rows: PitcherArsenalRow[]): PitcherArsenalByHand {
  const out: PitcherArsenalByHand = { A: [], R: [], L: [] };
  for (const row of rows) {
    const hand = normalizeVsBatterHand(row.vs_batter_hand);
    out[hand].push({ ...row, vs_batter_hand: hand });
  }
  return {
    A: dedupeByPitchType(out.A),
    R: dedupeByPitchType(out.R),
    L: dedupeByPitchType(out.L),
  };
}

export function effectiveBatSide(batter: BatterSplitRow | LineupRow, pitcherHand: PitchHand): 'R' | 'L' {
  const side = 'bat_side' in batter ? batter.bat_side : null;
  if (side === 'S') return pitcherHand === 'R' ? 'L' : 'R';
  if (side === 'L' || side === 'R') return side;
  return 'R';
}

export function getArsenalForBatter(
  batter: BatterSplitRow | LineupRow,
  pitcherHand: PitchHand,
  arsenalsByHand: PitcherArsenalByHand,
  minPitches = 25,
  minUsable = 3,
): PitcherArsenalRow[] {
  const side = effectiveBatSide(batter, pitcherHand);
  const split = side === 'R' ? arsenalsByHand.R : arsenalsByHand.L;
  const usable = split.filter(p => (p.pitches_thrown ?? 0) >= minPitches);
  return usable.length >= minUsable ? split : arsenalsByHand.A;
}

export function defaultArsenalTab(lineup: LineupRow[], pitcherHand: PitchHand): 'A' | 'R' | 'L' {
  let r = 0;
  let l = 0;
  for (const b of lineup) {
    const effective = effectiveBatSide(b, pitcherHand);
    if (effective === 'R') r += 1;
    else l += 1;
  }
  if (Math.abs(r - l) <= 1) return 'A';
  return r > l ? 'R' : 'L';
}

/**
 * Pitch types in the opposing starter's mix. Uses max sample across platoon
 * splits so a pitch isn't dropped when each hand split is under 25 pitches.
 */
export function arsenalPitchTypes(arsenal: PitcherArsenalByHand, minPitches = 1): string[] {
  const maxThrown = new Map<string, number>();
  for (const p of flattenArsenal(arsenal)) {
    const n = p.pitches_thrown ?? 0;
    const prev = maxThrown.get(p.pitch_type) ?? 0;
    if (n > prev) maxThrown.set(p.pitch_type, n);
  }
  return [...maxThrown.entries()]
    .filter(([, n]) => n >= minPitches)
    .sort((a, b) => b[1] - a[1])
    .map(([pt]) => pt);
}

export function flattenArsenal(arsenal: PitcherArsenalByHand): PitcherArsenalRow[] {
  return [...arsenal.A, ...arsenal.R, ...arsenal.L];
}

export function arsenalForDisplay(
  arsenal: PitcherArsenalByHand,
  opposingLineup: LineupRow[],
  pitcherHand: PitchHand,
): PitcherArsenalRow[] {
  const tab = defaultArsenalTab(opposingLineup, pitcherHand);
  const rows = arsenal[tab];
  const usable = rows.filter(p => (p.pitches_thrown ?? 0) >= 25);
  if (usable.length >= 3) return rows;
  return arsenal.A;
}
