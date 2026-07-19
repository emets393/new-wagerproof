# Cursor prompt — Phase 3: natural-language filter chat (web, NFL page)

> Copy below the line into Cursor. Wiring only — the model call, schema, and validation reducer are
> already built, tested, and deployed. Do NOT modify them. Testable with `npm run dev`.

---

## Context

We built a conversational filtering layer for the NFL Historical Analysis page. The backend is DONE and
DEPLOYED: a Supabase Edge Function `nl-filter-patch` turns a sentence into filter operations, and a
tested pure reducer `applyFilterPatch` validates + applies them. Your job is ONLY the UI wiring on
`src/pages/NFLAnalytics.tsx`: a chat input that calls the function, runs the reducer, applies the result
using the page's EXISTING `restore()` mechanism, and surfaces what happened.

**Do NOT modify** any of these (they are tested/deployed — changing them will break correctness):
- `src/features/analysis/applyFilterPatch.ts`
- `src/features/analysis/filterSchema.ts`
- `src/features/analysis/filterSchemaPrompt.ts`
- `supabase/functions/nl-filter-patch/*`

## The exact data flow to implement (inside the NFLAnalytics component)

1. Read the current filter as a full snapshot: `const current = snapshot();` (the component already has
   `snapshot(): NflWebFilterSnapshot`).
2. Build a COMPACT current-filter object for the model = `betType` plus only the fields that differ from
   the default. Import the default: `import { DEFAULT_NFL_SNAPSHOT } from '@/features/analysis/filterSchema';`
   ```ts
   const currentFilter: Record<string, unknown> = { betType: current.betType };
   for (const k of Object.keys(DEFAULT_NFL_SNAPSHOT)) {
     if (k === 'betType') continue;
     if (JSON.stringify((current as any)[k]) !== JSON.stringify((DEFAULT_NFL_SNAPSHOT as any)[k]))
       currentFilter[k] = (current as any)[k];
   }
   ```
3. Call the deployed Edge Function on the MAIN project (auth JWT is attached automatically):
   ```ts
   const { data, error } = await supabase.functions.invoke('nl-filter-patch', {
     body: { sentence, currentFilter, coaches, referees: refs },
   });
   ```
   (`supabase` is already imported from `@/integrations/supabase/client`; the component already has
   `coaches` and `refs` state.) The function returns `{ ops, couldnt_map, ambiguous }` or `{ error }`.
4. Validate + apply with the tested reducer:
   ```ts
   import { applyFilterPatch } from '@/features/analysis/applyFilterPatch';
   const result = applyFilterPatch(current, { ops: data.ops ?? [] }, { coaches, referees: refs });
   ```
5. Apply the new filter using the page's EXISTING apply path — do NOT hand-set the 58 states yourself:
   ```ts
   restore(result.snapshot);   // same mechanism used to load a saved filter; triggers the debounced refetch
   ```
6. Report to the user (see UI below) using `result.applied`, `result.rejected`, and `data.couldnt_map`,
   `data.ambiguous`.

## UI

- Add a small chat panel near the top of the results column (above the headline, or above the filter rail
  — your judgment for a clean layout). Use the existing UI primitives (`Card`, `Input`, `Button`).
- A text input + Send button; submit on Enter. Show a loading spinner while the request is in flight;
  disable submit when empty or loading.
- Placeholder / example chips to prime usage, e.g. "home favorites off a loss, weeks 2-10",
  "teams on a 3-game win streak getting a TD", "make it a moneyline for road dogs".
- After a turn, render a compact response block:
  - If `result.applied.length` — a one-line confirmation. The existing active-filter **chips already show
    the resulting filter in plain English**, so you don't need to re-describe every field; a short
    "Updated your filters ✓" is enough (optionally list changed dimension labels).
  - If `data.couldnt_map?.length` — show each as "Couldn't map: <text>" (these already include the nearest
    supported alternative from the model).
  - If `data.ambiguous?.length` — show each as "Too vague to apply: <text> — try being specific."
  - If `result.rejected.length` — show each reason (rare; the reducer explains why an op was dropped).
  - If nothing applied and no couldnt/ambiguous — "I didn't catch a filter in that — try rephrasing."
- Keep a minimal in-memory transcript of the user's messages + the response blocks (multi-turn refinement).
  Each turn is independent server-side — you always send the *current* filter, so refinements like "now
  only road teams" work because `current` reflects the prior turn.

## Rules / guardrails

- This is a PATCH on the live filter — never clear filters the user didn't mention. `restore(result.snapshot)`
  already handles that (the reducer only changed what it understood).
- Gate the chat on auth: the function requires a signed-in user (returns `{ error }` / 401 otherwise). Use
  the existing `useAuth()` `user`; if not signed in, show a subtle "Sign in to use filter chat" state
  instead of the input.
- Error handling: if `error` is set or `data.error` exists, show a friendly "Couldn't process that, try
  again" — never throw, never leave a spinner stuck.
- Do not change the existing filter controls, `buildFilters`, the RPC calls, or the result rendering.
- NFL page only (`src/pages/NFLAnalytics.tsx`). CFB/MLB come later.

## Run & hand-off

- `npm run dev`, leave it running. **Do NOT commit or push.**
- Tell me the route to open and a short summary. Try: "home favorites off a loss, favored 5-7, weeks 2-10"
  and confirm the filters (Regular season + weeks 2–10 + home + favorite 5–7 + last game lost) light up.

## Acceptance checklist

- [ ] Typing a sentence updates the filters (and the results refetch) via `restore(result.snapshot)`.
- [ ] "weeks 2-10" also turns on Regular season (the reducer auto-satisfies that); no filter is silently dropped.
- [ ] "make it a moneyline for road dogs" switches the bet type and sets away + underdog.
- [ ] Unmappable asks ("QB passer rating over 100") appear under Couldn't-map, not as a wrong filter.
- [ ] Signed-out users see a sign-in prompt, not an error.
- [ ] Existing manual controls, chips, and results behavior are unchanged; `npm run dev` running; nothing committed.
