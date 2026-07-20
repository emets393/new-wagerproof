/**
 * applyFilterPatch — the NFL binding of the generic sport filter engine.
 *
 * The full validation/apply implementation lives in `sportFilterEngine.ts` (one shared core for
 * NFL/CFB/MLB, so behavior can't drift between sports). This module keeps the original NFL public
 * API — same function signature, same exported types — and its test suite doubles as the engine's
 * behavior suite. See filterSchema.ts for the NFL dimension definitions + NFL_SPORT_CONFIG.
 */
import { NFL_SPORT_CONFIG } from './filterSchema';
import {
  applySportFilterPatch,
  type FilterPatch, type FilterPatchOp, type AppliedChange, type RejectedOp,
  type EngineResult, type EngineContext,
} from './sportFilterEngine';
import type { NflWebFilterSnapshot } from './normalizeSavedFilterSnapshot';

export type { FilterPatch, FilterPatchOp, AppliedChange, RejectedOp };
export type ApplyResult = EngineResult<NflWebFilterSnapshot>;

/** Runtime option lists the reducer can't know statically (loaded from the RPC in the page). */
export interface ApplyContext {
  teamAbbrs?: readonly string[];
  coaches?: readonly string[];
  referees?: readonly string[];
}

export function applyFilterPatch(
  current: NflWebFilterSnapshot, patch: FilterPatch, ctx: ApplyContext = {},
): ApplyResult {
  const engineCtx: EngineContext = {
    optionOverrides: ctx.teamAbbrs ? { nflTeams: ctx.teamAbbrs } : undefined,
    lists: { coaches: ctx.coaches, referees: ctx.referees },
  };
  return applySportFilterPatch(NFL_SPORT_CONFIG, current, patch, engineCtx);
}
