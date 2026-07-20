# Cursor prompt — Phase 5: NL filter chat on the CFB + MLB pages (web only, test locally)

> Copy everything below the line into Cursor. Web only — no iOS, no commits, no pushes, no deploys.
> The goal is a locally testable build via `npm run dev`.

---

## Context

Branch `feat/trends-systems`. The CFB and MLB Historical Analysis pages already received the FULL
Systems treatment in a prior pass (all filter groups, chips, reset, snapshot/restore, and the
SymmetricSplitHero 50%-integrity rule) — see `.claude/docs/trends-systems/06_PARITY_HANDOFF_2026-07-19.md`.
The ONLY missing web piece is the conversational **"Describe a filter" chat panel**, which NFL already
has (reference implementation: the NL chat block in `src/pages/NFLAnalytics.tsx` — Textarea entry,
example chips, transcript, response rendering).

The backend is multi-sport and DEPLOYED: the `nl-filter-patch` Edge Function takes a `sport`
parameter (`'nfl' | 'cfb' | 'mlb'`) and its prompt artifacts already know every CFB/MLB dimension.
Client-side validation for all three sports exists in `src/features/analysis/` (shared engine +
per-sport configs). 67/67 tests pass.

**Do NOT modify** (tested/deployed): anything in `src/features/analysis/*` (schemas, engine,
normalizers, prompts, tests), `supabase/functions/nl-filter-patch/*`, `scripts/*`.

## Task: port the NFL chat panel to `CFBAnalytics.tsx` and `MLBAnalytics.tsx`

Mirror the NFL implementation's UX exactly (same Card layout, wide auto-growing Textarea with
Enter-submits / Shift+Enter-newline, send button + spinner, example chips, compact transcript,
signed-in gating, friendly error handling, never a stuck spinner). Per-sport wiring:

### CFB (`src/pages/CFBAnalytics.tsx`)
```ts
import { applySportFilterPatch } from '@/features/analysis/sportFilterEngine';
import { CFB_SPORT_CONFIG, DEFAULT_CFB_SNAPSHOT } from '@/features/analysis/filterSchemaCfb';

// 1. compact current filter = betType + only fields differing from DEFAULT_CFB_SNAPSHOT
// 2. call the function:
const { data, error } = await supabase.functions.invoke('nl-filter-patch', {
  body: { sentence, currentFilter, sport: 'cfb' },
});
// 3. validate + apply client-side:
const result = applySportFilterPatch(CFB_SPORT_CONFIG, snapshot(), { ops: data.ops ?? [] });
// 4. apply via the page's EXISTING restore path: restore(result.snapshot)
```
No extra option lists needed — CFB teams/conferences are static in the schema.
Example chips: `"SEC home favorites laying 10+ in conference play"`,
`"ranked at home vs unranked off a blowout win"`, `"make it the moneyline for Ohio State as a dog"`.

### MLB (`src/pages/MLBAnalytics.tsx`)
```ts
import { applySportFilterPatch } from '@/features/analysis/sportFilterEngine';
import { MLB_SPORT_CONFIG } from '@/features/analysis/filterSchemaMlb';
import { MLB_SNAPSHOT_DEFAULTS } from '@/features/analysis/normalizeSavedFilterSnapshot';

// pitcherNames = the names from the page's already-loaded pitcher options (for the typeahead)
const { data, error } = await supabase.functions.invoke('nl-filter-patch', {
  body: { sentence, currentFilter, sport: 'mlb', pitchers: pitcherNames },
});
const result = applySportFilterPatch(MLB_SPORT_CONFIG, snapshot(), { ops: data.ops ?? [] },
  { optionOverrides: { mlbPitchers: pitcherNames } });
restore(result.snapshot);
```
Notes: the MLB snapshot is the canonical shape (see `MlbFilterSnapshot`); the page's snapshot/restore
round-trip was already aligned in the parity pass — reuse it, do not hand-set fields. The chat sets
pitchers by NAME (`spNames`/`oppSpNames`); if the page's restore maps names→ids for the RPC, keep
that mapping where it already lives.
Example chips: `"home dogs facing an ace lefty"`, `"run line for teams that won 5 straight"`,
`"day games where both teams go under more than half the time"`.

### Response rendering (same as NFL)
- `result.applied.length` → short "Updated your filters ✓" (chips already show the state).
- `data.couldnt_map` → "Couldn't map: …" lines (they include the nearest supported alternative).
- `data.ambiguous` → "Too vague: …". `result.rejected` reasons verbatim (rare).
- Nothing applied + nothing flagged → "I didn't catch a filter — try rephrasing."
- Function `error` / `data.error` → "Couldn't process that, try again."

### Guardrails
- Patch semantics: never clear filters the user didn't mention — `restore(result.snapshot)` +
  the reducer already guarantee this; don't add your own state juggling.
- Keep the SymmetricSplitHero + all existing controls untouched.
- Extract shared chat UI into a small reusable component ONLY if it stays purely presentational
  (state/network per page); otherwise duplicating the ~100-line block per page is acceptable.

## Run & hand-off (testing only — NOT production)
- Start the dev server: `npm run dev` (it is not currently running) and LEAVE IT RUNNING.
- Smoke-test in the browser (signed in):
  - `/cfb-analytics`: type "SEC home favorites laying 10 or more in conference play" → conference,
    side, favored 10–50, conference-game chips light up + refetch.
  - `/mlb`-analytics page: type "home dogs facing an ace lefty with the wind blowing in" →
    side/favDog/oppSpXfip/oppSpHand/windDir set.
  - Confirm an unfiltered CFB Spread still shows the split hero, and applying a side via chat flips
    to the normal hero.
- **Do NOT commit, push, or deploy anything.** Leave all changes in the working tree.
- Report: routes tested, sentences tried + results, anything ambiguous you decided.

## Acceptance
- [ ] CFB + MLB pages each have the chat panel with sport-correct example chips.
- [ ] Sentences update filters via `applySportFilterPatch` + `restore(...)`; results refetch.
- [ ] MLB pitcher sentences validate against the loaded list (unknown pitcher → rejected/couldn't-map,
      never a silent wrong filter).
- [ ] Signed-out users see the sign-in prompt; errors never strand the spinner.
- [ ] NFL page untouched; existing CFB/MLB controls + heroes untouched; 67 tests still pass
      (`npx vitest run src/features/analysis/`).
- [ ] `npm run dev` running; nothing committed/pushed/deployed.
