// unitBands — single source of truth for model-set unit sizing. Consumed by
// (a) the per-agent `units` enum on submit_picks, (b) the prompt hint, and
// (c) the deterministic clamp in the validator — so they can never drift.
//
// V3 lets the model size each pick by conviction within a band scaled to the
// agent's risk_tolerance (V2 hardcoded units:1.0). Grading needs zero changes:
// recalculate_avatar_performance already multiplies stored units via Formula B.

export interface UnitBand {
  min: number;
  base: number; // suggested stake at confidence 3
  max: number;
  enumValues: number[]; // 0.5-increment allowed values, min..max
}

function halfStepEnum(min: number, max: number): number[] {
  const out: number[] = [];
  for (let v = min; v <= max + 1e-9; v += 0.5) out.push(Math.round(v * 2) / 2);
  return out;
}

/** Risk band table (plan §4.2). `chase_value` widens the top by +1u (capped 5). */
export function unitBand(riskTolerance: number, chaseValue = false): UnitBand {
  const r = Math.min(Math.max(Math.round(riskTolerance || 3), 1), 5);
  const table: Record<number, { min: number; base: number; max: number }> = {
    1: { min: 0.5, base: 1.0, max: 1.5 },
    2: { min: 0.5, base: 1.0, max: 2.0 },
    3: { min: 0.5, base: 1.5, max: 3.0 },
    4: { min: 1.0, base: 2.0, max: 4.0 },
    5: { min: 1.0, base: 2.5, max: 5.0 },
  };
  const b = table[r];
  const max = chaseValue ? Math.min(5.0, b.max + 1.0) : b.max;
  return { min: b.min, base: b.base, max, enumValues: halfStepEnum(b.min, max) };
}

function snapHalf(v: number): number {
  return Math.round(v * 2) / 2;
}

/** Conviction-scaled suggestion within the band. */
export function suggestedUnits(band: UnitBand, confidence: number): number {
  const c = Math.min(Math.max(Math.round(confidence || 3), 1), 5);
  const step = (band.max - band.base) / 2;
  return Math.min(Math.max(snapHalf(band.base + (c - 3) * step), band.min), band.max);
}

export interface UnitClampResult {
  units: number;
  overridden: boolean;
  reason: string | null;
  modelRequested: number | null;
  suggested: number;
}

/** Deterministic clamp (validator). Never drops a pick. Falls back to the
 *  suggestion when the model omits/garbles units; snaps to 0.5; clamps to band;
 *  a low-confidence pick (≤2) may not exceed the band base. */
export function clampUnits(
  requested: number | null | undefined,
  band: UnitBand,
  confidence: number,
): UnitClampResult {
  const suggested = suggestedUnits(band, confidence);
  let units: number;
  let reason: string | null = null;

  if (requested == null || !Number.isFinite(requested)) {
    units = suggested;
    reason = "missing_or_invalid";
  } else {
    units = snapHalf(requested);
    if (units !== requested) reason = "snapped_to_half";
  }

  const lo = band.min;
  const hi = (confidence ?? 3) <= 2 ? band.base : band.max;
  const clamped = Math.min(Math.max(units, lo), hi);
  if (clamped !== units) {
    units = clamped;
    reason = reason ? `${reason}+clamped` : "clamped_to_band";
  }

  const modelRequested = requested == null || !Number.isFinite(requested) ? null : requested;
  return { units, overridden: reason !== null, reason, modelRequested, suggested };
}
