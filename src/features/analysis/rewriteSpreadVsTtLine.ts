/**
 * NL safety net: "spread of N+" must never become ttLineRange.
 * Models often latch onto the result market name ("team totals …") and map
 * the number onto the TT line. Only remap when the sentence clearly names a
 * spread and does NOT explicitly name a team-total line.
 */
import type { FilterPatch } from './sportFilterEngine';

type PatchOp = FilterPatch['ops'][number];

const SPREAD_TALK =
  /\bspread\b|\blaying\b|\bgetting\b|\bfavou?red by\b|\bfavored by\b|\bgiving\b\s+\d/i;
const EXPLICIT_TT_LINE =
  /team\s*totals?\s*line|\btt\s*line\b|posted\s+team\s+total|team\s+total\s+(?:of|at|is|between)\s+\d/i;

export function rewriteSpreadVsTtLineOps(
  sentence: string,
  ops: FilterPatch['ops'],
  opts?: { spreadMax?: number },
): FilterPatch['ops'] {
  const spreadMax = opts?.spreadMax ?? 50;
  if (!SPREAD_TALK.test(sentence) || EXPLICIT_TT_LINE.test(sentence)) return ops;

  const hasSpreadSize = ops.some(
    (o) => o?.op === 'set' && o.dimension === 'spreadSize',
  );

  const out: PatchOp[] = [];
  let remappedFromTt: [number, number] | null = null;
  for (const op of ops) {
    if (!op || typeof op !== 'object') { out.push(op); continue; }
    if (op.op === 'set' && op.dimension === 'ttLineRange' && Array.isArray(op.value) && op.value.length >= 2) {
      if (hasSpreadSize) continue; // drop mistaken TT line; keep existing spreadSize
      const lo = Number(op.value[0]);
      const hi = Number(op.value[1]);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) { out.push(op); continue; }
      remappedFromTt = [Math.max(0, lo), Math.min(spreadMax, Math.max(lo, hi))];
      out.push({ op: 'set', dimension: 'spreadSize', value: remappedFromTt });
      continue;
    }
    out.push(op);
  }

  // If we remapped a "spread of N" onto spreadSize and fav/dog role is already set,
  // ensure spreadSide matches so abs-spread doesn't include the other side.
  if (remappedFromTt) {
    const hasSpreadSide = out.some((o) => o?.op === 'set' && o.dimension === 'spreadSide');
    if (!hasSpreadSide) {
      const fav = out.find((o) => o?.op === 'set' && o.dimension === 'favDog'
        && (o.value === 'favorite' || o.value === 'underdog'));
      if (fav) out.push({ op: 'set', dimension: 'spreadSide', value: fav.value });
    }
  }
  return out;
}
