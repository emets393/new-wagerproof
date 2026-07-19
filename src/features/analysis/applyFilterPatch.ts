/**
 * applyFilterPatch — the ONLY sanctioned way to mutate an NFL analysis filter snapshot from a patch.
 *
 * The natural-language layer (and any programmatic caller) produces a PATCH in *snapshot space*; this
 * reducer validates every operation against `filterSchema.ts` and applies it to a copy of the snapshot.
 * It is the last line of defense before a value reaches the query, so it is deliberately strict and
 * defensive:
 *   • pure — no side effects, returns a new snapshot; the input is never mutated.
 *   • never throws — a malformed/off-schema/out-of-range op is REJECTED with a reason, and every other
 *     op in the patch still applies. Nothing is silently dropped.
 *   • clamps numeric ranges to the dimension's live bounds (bet-type-aware) and snaps to the step grid.
 *   • gates on availability — an op targeting a dimension that isn't active for the current bet type /
 *     season type is rejected (so the model can't set a control that would silently do nothing).
 *   • coerces percents (UI 0–100) and guards the 0–1 fraction mistake that would otherwise corrupt a query.
 *
 * The snapshot→RPC translation still lives in buildFilters() (NFLAnalytics.tsx); this reducer only
 * produces a valid snapshot. See filterSchema.ts for the dimension definitions and rpcNotes.
 */
import {
  DEFAULT_NFL_SNAPSHOT, NFL_FILTER_DIMENSIONS, NFL_BET_TYPES, NFL_TEAM_ABBRS, NFL_TEAM_ALIASES,
  NFL_DAYS, NFL_DAY_ALIASES, NFL_DIVISIONS,
  numRangeBounds,
  type FilterDimension, type NflBetType,
} from './filterSchema';
import type { NflWebFilterSnapshot } from './normalizeSavedFilterSnapshot';

// ── Patch shape ─────────────────────────────────────────────────────────────────────────────
export type FilterPatchOp =
  | { op: 'set'; dimension: string; value: unknown }
  | { op: 'clear'; dimension: string }
  | { op: 'addItems'; dimension: string; items: unknown }     // multiselect only
  | { op: 'removeItems'; dimension: string; items: unknown };  // multiselect only

export interface FilterPatch {
  ops: FilterPatchOp[];
}

export interface AppliedChange {
  dimension: string;
  from: unknown;
  to: unknown;
  /** Set when the applied value differed from what was requested (e.g. clamped, deduped, partially valid). */
  note?: string;
}
export interface RejectedOp {
  op: FilterPatchOp;
  reason: string;
}

export interface ApplyResult {
  snapshot: NflWebFilterSnapshot;
  applied: AppliedChange[];
  rejected: RejectedOp[];
  /** True when nothing changed (every op rejected or a no-op). */
  noChange: boolean;
}

/** Runtime option lists the reducer can't know statically (loaded from the RPC in the page). */
export interface ApplyContext {
  teamAbbrs?: readonly string[];   // defaults to NFL_TEAM_ABBRS
  coaches?: readonly string[];     // required to accept a `coach` value
  referees?: readonly string[];    // required to accept a `referee` value
}

// ── small numeric helpers (deterministic) ──────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const roundToStep = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(4));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const pairEq = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];

type Dimensions = typeof NFL_FILTER_DIMENSIONS;
type DimKey = keyof Dimensions;
const isDimKey = (k: string): k is DimKey => Object.prototype.hasOwnProperty.call(NFL_FILTER_DIMENSIONS, k);

/** Deep clone via JSON — snapshot holds only numbers/strings/booleans/null/arrays, so this is lossless. */
function cloneSnapshot(s: NflWebFilterSnapshot): NflWebFilterSnapshot {
  return JSON.parse(JSON.stringify(s));
}

/** Reset spread/total controls + season floor when the bet type changes (mirrors NFLAnalytics useEffect). */
function applyBetTypeSideEffects(next: NflWebFilterSnapshot): void {
  const bt = next.betType as NflBetType;
  next.spreadSize = [...numRangeBounds(NFL_FILTER_DIMENSIONS.spreadSize, bt)];
  next.lineRange = [...numRangeBounds(NFL_FILTER_DIMENSIONS.lineRange, bt)];
  const floor = numRangeBounds(NFL_FILTER_DIMENSIONS.seasons, bt)[0];
  if (next.seasons[0] < floor) next.seasons = [floor, next.seasons[1]];
}

function normalizeTeam(raw: unknown, valid: ReadonlySet<string>): string | null {
  if (typeof raw !== 'string') return null;
  const up = raw.trim().toUpperCase();
  const canonical = NFL_TEAM_ALIASES[up] ?? up;
  return valid.has(canonical) ? canonical : null;
}

/** Resolve a raw multiselect item to its canonical value, per the dimension's option source. */
function multiselectNormalizer(dim: FilterDimension, ctx: ApplyContext): (raw: unknown) => string | null {
  if (dim.kind !== 'multiselect') return () => null;
  if (dim.optionSource === 'daysOfWeek') {
    const valid = new Set<string>(NFL_DAYS as readonly string[]);
    return (raw) => {
      if (typeof raw !== 'string') return null;
      const t = raw.trim();
      const canon = NFL_DAY_ALIASES[t.toLowerCase()] ?? (valid.has(t) ? t : null);
      return canon && valid.has(canon) ? canon : null;
    };
  }
  if (dim.optionSource === 'nflDivisions') {
    return (raw) => {
      if (typeof raw !== 'string') return null;
      const hit = (NFL_DIVISIONS as readonly string[]).find((v) => v.toLowerCase() === raw.trim().toLowerCase());
      return hit ?? null;
    };
  }
  const valid = new Set<string>((ctx.teamAbbrs ?? NFL_TEAM_ABBRS) as readonly string[]);
  return (raw) => normalizeTeam(raw, valid);
}

/**
 * Validate + coerce a single dimension value for `set`. Returns the value to store, or a rejection reason.
 * Pure — reads only the dimension descriptor, the working snapshot (for bet-type bounds), and ctx.
 */
function coerceSetValue(
  dimKey: DimKey, dim: FilterDimension, value: unknown, next: NflWebFilterSnapshot, ctx: ApplyContext,
): { ok: true; value: unknown; note?: string } | { ok: false; reason: string } {
  const bt = next.betType as NflBetType;
  switch (dim.kind) {
    case 'enum': {
      if (typeof value !== 'string') return { ok: false, reason: 'expected a string option value' };
      if (value === 'any') return { ok: true, value: 'any' };
      const staticMatch = dim.options.some(([v]) => v === value && v !== 'any');
      if (staticMatch) return { ok: true, value };
      if (dim.dynamic) {
        const list = dimKey === 'coach' ? ctx.coaches : dimKey === 'referee' ? ctx.referees : undefined;
        if (!list) return { ok: false, reason: `${dim.label} options are not loaded, cannot verify "${value}"` };
        const hit = list.find((o) => o.toLowerCase() === value.toLowerCase());
        return hit ? { ok: true, value: hit } : { ok: false, reason: `"${value}" is not a known ${dim.label}` };
      }
      return { ok: false, reason: `"${value}" is not a valid ${dim.label} option` };
    }
    case 'tristate': {
      if (value === null || value === 'any') return { ok: true, value: null };
      if (value === true || value === 'yes' || value === 'true' || value === 1) return { ok: true, value: true };
      if (value === false || value === 'no' || value === 'false' || value === 0) return { ok: true, value: false };
      return { ok: false, reason: 'expected true, false, or null/any' };
    }
    case 'numRange':
    case 'pctRange': {
      if (!Array.isArray(value) || value.length < 2) return { ok: false, reason: 'expected a [min, max] range' };
      const a0 = Number(value[0]); const b0 = Number(value[1]);
      if (!isNum(a0) || !isNum(b0)) return { ok: false, reason: 'range bounds must be numbers' };
      const [min, max] = dim.kind === 'pctRange' ? [0, 100] : numRangeBounds(dim, bt);
      const step = dim.kind === 'pctRange' ? 1 : dim.step;
      // guard the "0.6 meant 60%" fraction mistake — no one filters a percent to <1%
      if (dim.kind === 'pctRange' && ((a0 > 0 && a0 < 1) || (b0 > 0 && b0 < 1))) {
        return { ok: false, reason: 'percent values use 0–100 (looks like a 0–1 fraction)' };
      }
      let a = clamp(roundToStep(a0, step), min, max);
      let b = clamp(roundToStep(b0, step), min, max);
      if (a > b) { const t = a; a = b; b = t; }
      const used: [number, number] = [a, b];
      const note = pairEq(used, [a0, b0]) ? undefined : `clamped to [${a}, ${b}]`;
      return { ok: true, value: used, note };
    }
    case 'scalarMax':
    case 'scalarMin': {
      if (!isNum(Number(value))) return { ok: false, reason: 'expected a number' };
      const raw = Number(value);
      const used = clamp(roundToStep(raw, dim.step), dim.min, dim.max);
      return { ok: true, value: used, note: used === raw ? undefined : `clamped to ${used}` };
    }
    case 'mlOdds': {
      const n = typeof value === 'string' ? Number(value.trim()) : Number(value);
      if (value === '' || value === null) return { ok: true, value: '' };        // clear this bound
      if (!isNum(n)) return { ok: false, reason: 'moneyline must be a number' };
      if (n > -100 && n < 100) return { ok: false, reason: 'American odds are ≥ +100 or ≤ −100' };
      return { ok: true, value: String(Math.round(n)) };
    }
    case 'multiselect': {
      if (!Array.isArray(value)) return { ok: false, reason: 'expected an array' };
      const norm = multiselectNormalizer(dim, ctx);
      const out: string[] = []; const bad: string[] = [];
      for (const item of value) {
        const t = norm(item);
        if (t) { if (!out.includes(t)) out.push(t); } else bad.push(String(item));
      }
      if (bad.length && !out.length) return { ok: false, reason: `unknown value(s): ${bad.join(', ')}` };
      return { ok: true, value: out, note: bad.length ? `ignored unknown value(s): ${bad.join(', ')}` : undefined };
    }
  }
}

/** Apply a validated patch to a snapshot. Pure; never throws. */
export function applyFilterPatch(
  current: NflWebFilterSnapshot, patch: FilterPatch, ctx: ApplyContext = {},
): ApplyResult {
  const next = cloneSnapshot(current);
  const applied: AppliedChange[] = [];
  const rejected: RejectedOp[] = [];

  const ops = Array.isArray(patch?.ops) ? patch.ops : [];
  for (const op of ops) {
    if (!op || typeof op !== 'object' || typeof (op as FilterPatchOp).dimension !== 'string') {
      rejected.push({ op: op as FilterPatchOp, reason: 'malformed operation' });
      continue;
    }
    const dimKey = op.dimension;

    // ── bet-type spine (not a filter dimension) ──
    if (dimKey === 'betType') {
      if (op.op === 'clear') {
        const from = next.betType;
        if (from === DEFAULT_NFL_SNAPSHOT.betType) { continue; }
        next.betType = DEFAULT_NFL_SNAPSHOT.betType;
        applyBetTypeSideEffects(next);
        applied.push({ dimension: 'betType', from, to: next.betType });
      } else if (op.op === 'set') {
        const v = op.value;
        if (typeof v !== 'string' || !NFL_BET_TYPES.includes(v as NflBetType)) {
          rejected.push({ op, reason: `"${String(v)}" is not a valid bet type` });
        } else if (v === next.betType) {
          // no-op
        } else {
          const from = next.betType;
          next.betType = v;
          applyBetTypeSideEffects(next);
          applied.push({ dimension: 'betType', from, to: v });
        }
      } else {
        rejected.push({ op, reason: 'betType supports only set/clear' });
      }
      continue;
    }

    // ── real dimensions ──
    if (!isDimKey(dimKey)) { rejected.push({ op, reason: `unknown dimension "${dimKey}"` }); continue; }
    const dim = NFL_FILTER_DIMENSIONS[dimKey];

    // clear is always allowed (safe even for an unavailable dimension)
    if (op.op === 'clear') {
      const from = (next as Record<string, unknown>)[dimKey];
      const def = (DEFAULT_NFL_SNAPSHOT as Record<string, unknown>)[dimKey];
      if (JSON.stringify(from) === JSON.stringify(def)) continue; // no-op
      (next as Record<string, unknown>)[dimKey] = Array.isArray(def) ? [...def] : def;
      applied.push({ dimension: dimKey, from, to: def });
      continue;
    }

    const bt = next.betType as NflBetType;
    // Market mismatch → reject. We never silently switch the user's chosen market to make a filter fit.
    if (dim.availability?.betTypes && !dim.availability.betTypes.includes(bt)) {
      rejected.push({ op, reason: `${dim.label} is not available for the ${bt} market` });
      continue;
    }
    // Intra-filter prerequisite (weeks ⇒ regular season, playoffRound ⇒ postseason): auto-satisfy it
    // deterministically rather than reject, so a user typing just "weeks 2–10" gets what they meant.
    if (dim.availability?.requires) {
      const rkey = dim.availability.requires.key as keyof NflWebFilterSnapshot;
      const rval = dim.availability.requires.equals;
      if ((next as Record<string, unknown>)[rkey] !== rval) {
        const rFrom = (next as Record<string, unknown>)[rkey];
        (next as Record<string, unknown>)[rkey] = rval;
        applied.push({ dimension: String(rkey), from: rFrom, to: rval, note: `set automatically for ${dim.label}` });
      }
    }

    if (op.op === 'set') {
      const res = coerceSetValue(dimKey, dim, op.value, next, ctx);
      if (!res.ok) { rejected.push({ op, reason: res.reason }); continue; }
      const from = (next as Record<string, unknown>)[dimKey];
      if (JSON.stringify(from) === JSON.stringify(res.value)) continue; // no-op
      (next as Record<string, unknown>)[dimKey] = res.value;
      applied.push({ dimension: dimKey, from, to: res.value, note: res.note });
      continue;
    }

    if (op.op === 'addItems' || op.op === 'removeItems') {
      if (dim.kind !== 'multiselect') { rejected.push({ op, reason: `${dim.label} is not a list` }); continue; }
      if (!Array.isArray(op.items)) { rejected.push({ op, reason: 'items must be an array' }); continue; }
      const resolve = multiselectNormalizer(dim, ctx);
      const from = ([...(next as Record<string, unknown>)[dimKey] as string[]]);
      const bad: string[] = [];
      const norm = op.items.map((i) => { const t = resolve(i); if (!t) bad.push(String(i)); return t; }).filter(Boolean) as string[];
      let out: string[];
      if (op.op === 'addItems') {
        out = [...from];
        for (const t of norm) if (!out.includes(t)) out.push(t);
      } else {
        out = from.filter((t) => !norm.includes(t));
      }
      if (JSON.stringify(from) === JSON.stringify(out)) {
        if (bad.length) rejected.push({ op, reason: `unknown value(s): ${bad.join(', ')}` });
        continue; // no-op
      }
      (next as Record<string, unknown>)[dimKey] = out;
      applied.push({ dimension: dimKey, from, to: out, note: bad.length ? `ignored unknown value(s): ${bad.join(', ')}` : undefined });
      continue;
    }

    rejected.push({ op, reason: `unsupported op "${(op as FilterPatchOp).op}"` });
  }

  return { snapshot: next, applied, rejected, noChange: applied.length === 0 };
}
