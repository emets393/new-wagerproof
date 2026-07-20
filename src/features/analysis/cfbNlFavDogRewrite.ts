/**
 * CFB NL post-process: route favorite/underdog language onto the dimension that
 * exists for the *current* (or newly set) bet type.
 *
 * Default market is fg_spread, where favDog is unavailable — models often emit
 * favDog for "Michigan as underdogs", which the engine then silently rejects.
 * On spread markets that becomes spreadSide; on ML / team_total it stays favDog
 * (and mistaken spreadSide ops are remapped the other way).
 */
import type { FilterPatch } from './sportFilterEngine';

const SPREAD_MARKETS = new Set(['fg_spread', 'h1_spread']);
const FAVDOG_MARKETS = new Set(['fg_ml', 'h1_ml', 'team_total']);

type PatchOp = FilterPatch['ops'][number];

function effectiveBetType(currentBetType: string, ops: FilterPatch['ops']): string {
  for (const op of ops) {
    if (op?.op === 'set' && op.dimension === 'betType' && typeof op.value === 'string') {
      return op.value;
    }
  }
  return currentBetType;
}

function isFavDogValue(v: unknown): v is 'favorite' | 'underdog' {
  return v === 'favorite' || v === 'underdog';
}

export function rewriteCfbFavDogOps(
  currentBetType: string,
  ops: FilterPatch['ops'],
): FilterPatch['ops'] {
  const bt = effectiveBetType(currentBetType, ops);
  // Numeric spread in the same patch ⇒ keep spreadSide even on ML/TT markets
  // ("favorites with a spread of 28+" must not collapse to favDog-only).
  const hasSpreadSize = ops.some(
    (o) => o?.op === 'set' && o.dimension === 'spreadSize',
  );
  const out: PatchOp[] = [];
  let sawSpreadSide = false;
  let sawFavDog = false;

  for (const op of ops) {
    if (!op || typeof op !== 'object') { out.push(op); continue; }

    if (op.op === 'set' && op.dimension === 'favDog' && isFavDogValue(op.value)) {
      if (SPREAD_MARKETS.has(bt)) {
        // Remap onto spreadSide for ATS markets.
        if (!sawSpreadSide) {
          out.push({ op: 'set', dimension: 'spreadSide', value: op.value });
          sawSpreadSide = true;
        }
        continue;
      }
      if (FAVDOG_MARKETS.has(bt)) {
        sawFavDog = true;
        out.push(op);
        continue;
      }
      // Game totals: fav/dog isn't meaningful — drop.
      continue;
    }

    if (op.op === 'set' && op.dimension === 'spreadSide' && isFavDogValue(op.value)) {
      if (FAVDOG_MARKETS.has(bt) && !hasSpreadSize) {
        if (!sawFavDog) {
          out.push({ op: 'set', dimension: 'favDog', value: op.value });
          sawFavDog = true;
        }
        continue;
      }
      if (SPREAD_MARKETS.has(bt) || (FAVDOG_MARKETS.has(bt) && hasSpreadSize)) {
        sawSpreadSide = true;
        out.push(op);
        // On TT/ML, also mirror into favDog when present for role filters.
        if (FAVDOG_MARKETS.has(bt) && hasSpreadSize && !sawFavDog) {
          out.push({ op: 'set', dimension: 'favDog', value: op.value });
          sawFavDog = true;
        }
        continue;
      }
      continue;
    }

    out.push(op);
  }

  return out;
}
