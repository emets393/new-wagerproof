# Cursor prompt — Phase 4: web chat polish + iOS port of the Trends/Systems features

> Copy everything below the line into Cursor.

---

## What changed (context — read before coding)

You are on branch **`feat/trends-systems`** (commits `2572bf36` + `fd414087`). The NFL Historical
Analysis stack was overhauled; the web page is DONE and approved. Summary of what now exists:

1. **New filter dimensions (66 total)** on the NFL page, all backed by live warehouse columns + RPC
   params (contract: `.claude/docs/trends-systems/05_LIVE_FILTER_KEYS.md`):
   - Season-to-date "as-of" groups: Season Record (win%, streaks, >.500, PPG/PA/diff, min-games),
     Cover Profile (ATS win%, ATS streak, avg cover margin), Total Profile (over%/streaks),
     Prior Year, Head-to-Head (last meeting), Opponent Record.
   - **Opponent last game** group (result / ATS / total / role / OT — mirror of "Last game").
   - **Last-game margin** sliders (signed −60..60, + = won by / − = lost by) replacing the old
     "Blowout ±21" enum, for both team and opponent.
   - **Multi-select days of week** (Sun–Sat chips, Situation) and **team divisions** (8 divisions,
     Matchup) — see the `MultiToggle` component in `NFLAnalytics.tsx`.
2. **NL filter chat** ("Describe a filter"): sentence → `nl-filter-patch` Edge Function (OpenAI) →
   validated patch → applied via `restore()`. Web validates client-side with
   `src/features/analysis/applyFilterPatch.ts`.
3. **Symmetric split hero**: on two-sided markets (Spread/ML/1H variants) with only game-level
   filters active, "all teams" is mathematically forced to ~50%, so the hero shows the real
   fav/dog + home/away splits instead (`SymmetricSplitHero` in `NFLAnalytics.tsx`,
   `isSideSymmetric` in `filterSchema.ts`).
4. **Real price-based ROI on ALL 7 markets** — the RPC now returns non-null `roi` everywhere,
   including both moneylines (computed from real closing prices). Nothing should hide ROI anymore.

**DO NOT MODIFY** (tested/deployed; changing them breaks correctness):
`src/features/analysis/{filterSchema,applyFilterPatch,filterSchemaPrompt}*.ts`,
`supabase/functions/nl-filter-patch/*`, `scripts/*`, the SQL/py under `research/`.

---

## Part A — Web: clean up the "Describe a filter" entry (NFLAnalytics.tsx)

Problem: the text input is too small — while typing, earlier text scrolls out of view.

- Make the entry **full-width** within its card and switch it to an auto-growing **`Textarea`**
  (1 row min, grows to ~3, ~500-char max to match the server cap) so long sentences stay visible.
  Keep Enter = submit (Shift+Enter = newline), keep the send button, spinner, disabled states.
- Keep the example chips + transcript exactly as they are; just give the input room to breathe
  (the card can span the full content column).
- Do NOT change the request/response logic, `applyFilterPatch` usage, or `restore()` flow.
- Versus-bar note: the green fill deliberately marks the side above 50% (the gray side is its
  complement). **Keep that semantic exactly.** You may slightly raise the gray label's contrast
  (e.g. `text-muted-foreground` → `text-foreground/70`) so both labels are readable, but do not
  add a second fill color.

## Part B — iOS: port the new features (wagerproof-ios-native)

Reference docs: `.claude/docs/15_mobile_historical_analysis.md` (the iOS screen's design system:
liquid-glass pills → sheets, plain sections, no cards) and `05_LIVE_FILTER_KEYS.md` (RPC keys).
The Historical Analysis Swift files have **uncommitted working-tree changes — build on top of
them, do not revert.** Match the existing visual language exactly; the screen must stay as clean
as it is today.

### B1 — New filters (keep the pill row tight: add TWO pills, not eleven)
- Pill **"Team form"** → sheet with segmented sections: Season Record, Cover Profile,
  Total Profile, Prior Year. Range sliders/toggles mirror the web bounds exactly
  (percents UI 0–100 → send 0–1; streaks 0–16; PPG/PA 0–40 step 0.5; point diff −20..20;
  min-games 0–10). RPC keys per doc 05.
- Pill **"Matchups"** → sheet with sections: Head-to-Head (last meeting), Opponent Record,
  Opponent last game (result/ATS/total/role/OT + margin slider).
- Extend existing sheets: **Last game** gets the signed margin slider (−60..60, label
  "+ = won by, − = lost by") replacing any blowout control; **Situation** gets the days-of-week
  chip multi-select; **Matchup** gets the division chip multi-select (8 divisions).
- `HistoricalAnalysisFilterBuilder` maps all of these to the RPC keys in doc 05 (percent → 0–1,
  ranges → `_min`/`_max` only when narrowed, margin → `last_margin_*` / `opp_last_margin_*`,
  arrays for `day_of_week` / `team_division`).
- **Saved-filter serialization:** the new dimensions must serialize with the WEB key names and
  shapes — 2-element arrays for ranges (`winPct: [60,100]`, `lastMargin: [-60,-10]`), string
  arrays for `daysOfWeek`/`teamDivisions`, flat strings for `oppLastResult` etc. — because the
  shared normalizer (`normalizeSavedFilterSnapshot.ts`) only reads those shapes for these fields.
- Active-filter chips for every new dimension (mirror the web chip labels).

### B2 — Symmetric split hero (the 50% integrity fix)
When bet type ∈ {fg_spread, fg_ml, h1_spread, h1_ml} AND the only active filters are from this
GAME-LEVEL set — seasons, weeks, seasonType, playoffRound, lineRange, spreadSize (either-side),
primetime, division(bool), dome, tempRange, windMax, precip, referee, daysOfWeek, minGames —
the overall is a forced ~50% tautology. Replace the headline with the split view (mirror the web
`SymmetricSplitHero`): headline = the more extreme side from the RPC `bars` (home_away + fav_dog),
its ROI, two versus-bars with a 50% midline (green fill = the >50% side, right-aligned), tap a
side to set that filter, plus the subline: "Every game here has one side that covers and one that
doesn't, so 'all teams' is always ~50% on this market — these are the real splits." Any OTHER
active filter → normal headline (unchanged).

### B3 — ROI everywhere
Remove any "hide ROI for moneyline" logic — the RPC returns real ROI for every market now
(doc 15 was updated). Show ROI wherever hit% shows, same thresholds as web.

### B4 — NL filter chat ("Describe a filter")
Add the chat entry above the results (same visual weight as web: compact card, auto-growing
text field, send button, example chips, small transcript). iOS uses the function's
**server-validated mode** — no client-side validation needed:

```
POST {main project}/functions/v1/nl-filter-patch     (user JWT auth — signed-in users only)
body: { sentence, currentFilter, coaches, referees, apply: true }
  - currentFilter: the CURRENT filter serialized in the web snapshot shape (betType + only
    non-default fields — same serialization as saved filters)
  - coaches / referees: the lists already loaded for those pickers
resp: { snapshot, applied: [{dimension, from, to, note?}], rejected: [reason strings],
        noChange, couldnt_map: [..], ambiguous: [..] }   |   { error }
```

Apply `snapshot` through the SAME code path that restores a saved filter (it is exactly that
shape), then refetch. Render the report: "Updated your filters ✓" on applied; each `couldnt_map`
as "Couldn't map: …"; `ambiguous` as "Too vague: …"; `rejected` reasons verbatim; `noChange` with
nothing else → "I didn't catch a filter — try rephrasing." Signed-out → "Sign in to use filter
chat." Errors → friendly retry message, never a stuck spinner.

## Run — simulator (REQUIRED before hand-off)

1. `cd wagerproof-ios-native` — discover the scheme (`xcodebuild -list`), build for an iPhone
   simulator (e.g. `xcodebuild -scheme <scheme> -destination 'platform=iOS Simulator,name=iPhone 16' build`).
2. Boot the simulator, install + launch the app, navigate to the NFL game page → Historical
   Trends banner, and leave it running for review.
3. Fix any build errors you introduced until it compiles clean.

## Hand-off rules
- Work on branch `feat/trends-systems`. **Do NOT commit or push** — leave changes in the working
  tree for review.
- Web dev server should stay running (`npm run dev`) for Part A review.
- Report: what changed, anything ambiguous you decided yourself, and the exact simulator
  scheme/device used.

## Acceptance
- [ ] Web: chat input is full-width, multi-line, text stays visible while typing; nothing else changed.
- [ ] iOS: two new pills open Team form / Matchups sheets; margin sliders, days + divisions
      multi-selects present; chips work; saved filters round-trip with web (tuple shapes).
- [ ] iOS: unfiltered Spread shows the split hero (not 50%); adding "Home" flips to the normal hero.
- [ ] iOS: ROI visible on Moneyline markets.
- [ ] iOS: typing "home favorites off a loss, favored 5-7, weeks 2-10" in chat sets those filters
      via the apply:true response; unmappable asks surface as "Couldn't map."
- [ ] Simulator running with the app on the Historical screen; nothing committed or pushed.
