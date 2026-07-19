/**
 * sportFilterEngine — the generic, sport-agnostic core of the filter-patch reducer.
 *
 * ONE implementation of the validation/apply logic, parameterized by a `SportFilterConfig`
 * (dimensions, defaults, bet types, option lists, bounds resolution, bet-type side effects).
 * NFL/CFB/MLB each supply a config; none of them duplicate reducer logic, so the correctness
 * guarantees (clamping, enum gating, availability, percent-fraction guard, op isolation,
 * never-throws) cannot drift between sports.
 *
 * The NFL-specific `applyFilterPatch` remains the public API for the NFL page (a thin binding
 * over this engine) — its 30+ behavior tests exercise this engine directly.
 */

// ── Dimension descriptor (generic over the sport's bet-type strings) ────────────────────────
type EnumOption = readonly [value: string, label: string];

export interface DimAvailability {
  betTypes?: readonly string[];
  requires?: { key: string; equals: string };
}

interface DimBase {
  group: string;
  label: string;
  aliases?: readonly string[];
  availability?: DimAvailability;
  rpcNote?: string;
}

export type EngineDimension =
  | (DimBase & {
      kind: 'numRange'; min: number; max: number; step: number; unit?: string;
      boundsByBetType?: Partial<Record<string, readonly [number, number]>>;
      limitedFloor?: number;
    })
  | (DimBase & { kind: 'pctRange' })
  | (DimBase & { kind: 'scalarMax'; min: number; max: number; step: number; unit?: string })
  | (DimBase & { kind: 'scalarMin'; min: number; max: number; step: number })
  | (DimBase & { kind: 'enum'; options: readonly EnumOption[]; dynamic?: boolean })
  | (DimBase & { kind: 'tristate' })
  | (DimBase & { kind: 'multiselect'; optionSource: string })
  | (DimBase & { kind: 'mlOdds'; bound: 'min' | 'max' })
  | (DimBase & { kind: 'text'; pattern?: string });

/** A named list of valid multiselect values + how loose matching may be. */
export interface SportOptionList {
  values: readonly string[];
  /** alias (lowercased) → canonical value. */
  aliases?: Record<string, string>;
}

export interface SportFilterConfig<S extends Record<string, unknown> = Record<string, unknown>> {
  sport: string;
  betTypes: readonly string[];
  defaultSnapshot: S;
  dimensions: Record<string, EngineDimension>;
  optionLists: Record<string, SportOptionList>;
  /** dynamic-enum dimension key → EngineContext.lists key holding the runtime options. */
  dynamicEnumCtx?: Record<string, string>;
  /** reset bet-type-dependent controls after a betType change (mirrors the page's useEffect). */
  applyBetTypeSideEffects?: (next: S) => void;
  /** effective [min,max] for a numRange under the current bet type. */
  numRangeBounds: (dim: EngineDimension & { kind: 'numRange' }, betType: string) => [number, number];
}

// ── Patch + result shapes (shared across sports) ────────────────────────────────────────────
export type FilterPatchOp =
  | { op: 'set'; dimension: string; value: unknown }
  | { op: 'clear'; dimension: string }
  | { op: 'addItems'; dimension: string; items: unknown }
  | { op: 'removeItems'; dimension: string; items: unknown };

export interface FilterPatch { ops: FilterPatchOp[]; }

export interface AppliedChange { dimension: string; from: unknown; to: unknown; note?: string; }
export interface RejectedOp { op: FilterPatchOp; reason: string; }

export interface EngineResult<S> {
  snapshot: S;
  applied: AppliedChange[];
  rejected: RejectedOp[];
  noChange: boolean;
}

export interface EngineContext {
  /** override an optionList's values at runtime (e.g. teams loaded from the DB). */
  optionOverrides?: Record<string, readonly string[]>;
  /** dynamic-enum option lists (e.g. coaches/referees/pitchers), keyed per dynamicEnumCtx. */
  lists?: Record<string, readonly string[] | undefined>;
}

// ── helpers ────────────────────────────────────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const roundToStep = (v: number, step: number) => Number((Math.round(v / step) * step).toFixed(4));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const pairEq = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
const cloneSnapshot = <S,>(s: S): S => JSON.parse(JSON.stringify(s));

/** Resolve one raw multiselect item: exact → alias(lower) → uppercase-exact → case-insensitive. */
function resolveOption(raw: unknown, list: SportOptionList, override?: readonly string[]): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  const values = override ?? list.values;
  if (values.includes(t)) return t;
  const alias = list.aliases?.[t.toLowerCase()];
  if (alias && values.includes(alias)) return alias;
  const up = t.toUpperCase();
  if (values.includes(up)) return up;
  const ci = values.find((v) => v.toLowerCase() === t.toLowerCase());
  return ci ?? null;
}

function isDimensionAvailableGeneric(
  dim: EngineDimension, betType: string, snapshot: Record<string, unknown>,
): { ok: boolean; reason?: string } {
  if (dim.availability?.betTypes && !dim.availability.betTypes.includes(betType)) {
    return { ok: false, reason: `${dim.label} is not available for the ${betType} market` };
  }
  // `requires` is handled by auto-satisfying in the apply loop, not here.
  void snapshot;
  return { ok: true };
}

function coerceSetValue<S extends Record<string, unknown>>(
  cfg: SportFilterConfig<S>, dimKey: string, dim: EngineDimension, value: unknown,
  next: S, ctx: EngineContext,
): { ok: true; value: unknown; note?: string } | { ok: false; reason: string } {
  const bt = String(next.betType);
  switch (dim.kind) {
    case 'enum': {
      if (typeof value !== 'string') return { ok: false, reason: 'expected a string option value' };
      if (value === 'any') return { ok: true, value: 'any' };
      if (dim.options.some(([v]) => v === value && v !== 'any')) return { ok: true, value };
      if (dim.dynamic) {
        const listName = cfg.dynamicEnumCtx?.[dimKey];
        const list = listName ? ctx.lists?.[listName] : undefined;
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
      const [min, max] = dim.kind === 'pctRange' ? [0, 100] : cfg.numRangeBounds(dim, bt);
      const step = dim.kind === 'pctRange' ? 1 : dim.step;
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
    case 'text': {
      if (value === '' || value === null) return { ok: true, value: '' };
      if (typeof value !== 'string') return { ok: false, reason: 'expected a string' };
      const t = value.trim();
      if (dim.pattern && !new RegExp(dim.pattern).test(t)) {
        return { ok: false, reason: `${dim.label} must match ${dim.pattern}` };
      }
      return { ok: true, value: t };
    }
    case 'mlOdds': {
      const n = typeof value === 'string' ? Number(value.trim()) : Number(value);
      if (value === '' || value === null) return { ok: true, value: '' };
      if (!isNum(n)) return { ok: false, reason: 'moneyline must be a number' };
      if (n > -100 && n < 100) return { ok: false, reason: 'American odds are ≥ +100 or ≤ −100' };
      return { ok: true, value: String(Math.round(n)) };
    }
    case 'multiselect': {
      if (!Array.isArray(value)) return { ok: false, reason: 'expected an array' };
      const list = cfg.optionLists[dim.optionSource];
      if (!list) return { ok: false, reason: `${dim.label} options are not configured` };
      const override = ctx.optionOverrides?.[dim.optionSource];
      if (!list.values.length && !override) {
        return { ok: false, reason: `${dim.label} options are not loaded, cannot verify values` };
      }
      const out: string[] = []; const bad: string[] = [];
      for (const item of value) {
        const t = resolveOption(item, list, override);
        if (t) { if (!out.includes(t)) out.push(t); } else bad.push(String(item));
      }
      if (bad.length && !out.length) return { ok: false, reason: `unknown value(s): ${bad.join(', ')}` };
      return { ok: true, value: out, note: bad.length ? `ignored unknown value(s): ${bad.join(', ')}` : undefined };
    }
  }
}

/** Apply a validated patch to a snapshot. Pure; never throws. */
export function applySportFilterPatch<S extends Record<string, unknown>>(
  cfg: SportFilterConfig<S>, current: S, patch: FilterPatch, ctx: EngineContext = {},
): EngineResult<S> {
  const next = cloneSnapshot(current) as Record<string, unknown>;
  const applied: AppliedChange[] = [];
  const rejected: RejectedOp[] = [];
  const dflt = cfg.defaultSnapshot as Record<string, unknown>;
  const isDimKey = (k: string) => Object.prototype.hasOwnProperty.call(cfg.dimensions, k);

  const ops = Array.isArray(patch?.ops) ? patch.ops : [];
  for (const op of ops) {
    if (!op || typeof op !== 'object' || typeof (op as FilterPatchOp).dimension !== 'string') {
      rejected.push({ op: op as FilterPatchOp, reason: 'malformed operation' });
      continue;
    }
    const dimKey = op.dimension;

    if (dimKey === 'betType') {
      if (op.op === 'clear') {
        const from = next.betType;
        if (from === dflt.betType) continue;
        next.betType = dflt.betType;
        cfg.applyBetTypeSideEffects?.(next as S);
        applied.push({ dimension: 'betType', from, to: next.betType });
      } else if (op.op === 'set') {
        const v = op.value;
        if (typeof v !== 'string' || !cfg.betTypes.includes(v)) {
          rejected.push({ op, reason: `"${String(v)}" is not a valid bet type` });
        } else if (v !== next.betType) {
          const from = next.betType;
          next.betType = v;
          cfg.applyBetTypeSideEffects?.(next as S);
          applied.push({ dimension: 'betType', from, to: v });
        }
      } else {
        rejected.push({ op, reason: 'betType supports only set/clear' });
      }
      continue;
    }

    if (!isDimKey(dimKey)) { rejected.push({ op, reason: `unknown dimension "${dimKey}"` }); continue; }
    const dim = cfg.dimensions[dimKey];

    if (op.op === 'clear') {
      const from = next[dimKey];
      const def = dflt[dimKey];
      if (JSON.stringify(from) === JSON.stringify(def)) continue;
      next[dimKey] = Array.isArray(def) ? [...def] : def;
      applied.push({ dimension: dimKey, from, to: def });
      continue;
    }

    const bt = String(next.betType);
    const avail = isDimensionAvailableGeneric(dim, bt, next);
    if (!avail.ok) { rejected.push({ op, reason: avail.reason! }); continue; }
    // auto-satisfy an intra-filter prerequisite (e.g. weeks ⇒ seasonType='regular')
    if (dim.availability?.requires) {
      const { key: rkey, equals: rval } = dim.availability.requires;
      if (next[rkey] !== rval) {
        const rFrom = next[rkey];
        next[rkey] = rval;
        applied.push({ dimension: rkey, from: rFrom, to: rval, note: `set automatically for ${dim.label}` });
      }
    }

    if (op.op === 'set') {
      const res = coerceSetValue(cfg, dimKey, dim, op.value, next as S, ctx);
      if (!res.ok) { rejected.push({ op, reason: res.reason }); continue; }
      const from = next[dimKey];
      if (JSON.stringify(from) === JSON.stringify(res.value)) continue;
      next[dimKey] = res.value;
      applied.push({ dimension: dimKey, from, to: res.value, note: res.note });
      continue;
    }

    if (op.op === 'addItems' || op.op === 'removeItems') {
      if (dim.kind !== 'multiselect') { rejected.push({ op, reason: `${dim.label} is not a list` }); continue; }
      if (!Array.isArray(op.items)) { rejected.push({ op, reason: 'items must be an array' }); continue; }
      const list = cfg.optionLists[dim.optionSource];
      const override = ctx.optionOverrides?.[dim.optionSource];
      const from = [...(next[dimKey] as string[])];
      const bad: string[] = [];
      const norm = op.items
        .map((i) => { const t = list ? resolveOption(i, list, override) : null; if (!t) bad.push(String(i)); return t; })
        .filter(Boolean) as string[];
      let out: string[];
      if (op.op === 'addItems') {
        out = [...from];
        for (const t of norm) if (!out.includes(t)) out.push(t);
      } else {
        out = from.filter((t) => !norm.includes(t));
      }
      if (JSON.stringify(from) === JSON.stringify(out)) {
        if (bad.length) rejected.push({ op, reason: `unknown value(s): ${bad.join(', ')}` });
        continue;
      }
      next[dimKey] = out;
      applied.push({ dimension: dimKey, from, to: out, note: bad.length ? `ignored unknown value(s): ${bad.join(', ')}` : undefined });
      continue;
    }

    rejected.push({ op, reason: `unsupported op "${(op as FilterPatchOp).op}"` });
  }

  return { snapshot: next as S, applied, rejected, noChange: applied.length === 0 };
}
