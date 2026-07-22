# Cursor prompt — Systems save flow + Leaderboard UI (web only, test locally, NO deploy)

> Copy everything below the line into Cursor. Backend is DONE and live — do not create or
> modify anything in `supabase/` or `src/features/analysis/`. Web only (iOS comes in a
> later pass). Test on `npm run dev`. Do NOT commit, push, or deploy.

---

## Context

The Systems leaderboard backend is live (spec: `.claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md`).
A saved filter set + a user-chosen **verdict** (which side it bets) = a "system". A nightly
job grades every saved system with the exact same engine the analytics pages use, and
`analysis_systems_leaderboard` returns the top public systems by all-time ROI.

Two work items: (A) upgrade the Save flow on all three analytics pages
(`NFLAnalytics.tsx`, `CFBAnalytics.tsx`, `MLBAnalytics.tsx`), (B) build the leaderboard.

**Audience note from the owner: our users are NOT technical. Every label below was chosen
deliberately — use this copy (or gentler), never jargon like "verdict", "symmetric",
"snapshot", or "RPC" in the UI.**

## A. Save flow — "Save this System"

When the user clicks Save on an analytics page, open a dialog that asks ONE question
before naming the save. The wording:

**For spread / moneyline / run-line style markets** (NFL/CFB: fg_spread, fg_ml, h1_spread,
h1_ml; MLB: ml, rl, f5_ml, f5_rl):

> **Which side does this system bet?**
> - ⚡ **Bet ON these teams** — "Every time a team matches my filters, bet on them." → verdict `'team'`
> - 🔄 **Bet AGAINST these teams** — "Every time a team matches my filters, bet on the other side." → verdict `'fade'`

**For totals markets** (fg_total, h1_total, team_total / total, f5_total):

> **Which side does this system bet?**
> - ⬆️ **The Over** → verdict `'over'`
> - ⬇️ **The Under** → verdict `'under'`

**Special case — side market with "game-level only" filters**: if the current snapshot is
side-symmetric (use the EXISTING `isSideSymmetric` / `isSideSymmetricCfb` /
`isSideSymmetricMlb` helpers from `src/features/analysis/` — same ones that drive the
split hero), the filters describe the game but not a team. Do NOT show an error. Instead,
FIRST ask:

> **Your filters describe the game — now pick which side to track.**
> Every game has two teams. Which side does this system bet?
> [ Home teams ] [ Away teams ] [ Favorites ] [ Underdogs ]

Picking one literally sets that filter (side or favDog) on the page BEFORE saving — the
chips update, the hero flips from the split view to the normal one, and then the
team/fade question above appears. The user never sees a rejection.

**Confirmation line under the buttons (always shown, fills in their choice):**
> "We'll track this system's record as if you bet **[the Under / on these teams / against
> these teams]** once in every game that matches your filters."

**Share toggle (default OFF):**
> ☐ **Share to the Systems Leaderboard** — "Other users will see your username, this
> system's name, and its record. Systems need 10+ games of history to appear."

**What to save** (this is the critical data contract — the nightly grader replays these
verbatim, so the leaderboard number always equals the page number):
- `name` (user text), `bet_type` + `filters` (the UI snapshot — as today)
- `verdict` — from the dialog
- `rpc_bet_type` — the exact `p_bet_type` the page is currently querying the warehouse with
- `rpc_filters` — the exact `p_filters` object the page's buildFilters() produced for the
  current query (capture the same object you pass to `supabase.rpc('<sport>_analysis',…)`)
- `is_public` — from the toggle

Editing a saved system's filters is NOT supported — re-saving creates a new row (this is
intentional: "since saved" tracking must reset when filters change). Renaming and
sharing/unsharing ARE supported: update only `name` / `is_public` (the DB rejects updates
to other columns).

## B. Leaderboard

New page/tab "Systems Leaderboard" (linkable from all three analytics pages; pick the
placement that fits the current nav — a tab on the analytics pages or `/systems-leaderboard`).

Data: `supabase.rpc('analysis_systems_leaderboard', { p_sport: sportOrNull, p_limit: 50 })`
→ array sorted by all-time ROI, each row:
```
{ sport, system_id, name, verdict, bet_type, rpc_bet_type, filters, username, created_at,
  all_time: {n, wins, losses, pushes, hit_pct, roi, units},
  current_season: {…same}, season_label, since_saved: {…same},
  last10: {n, wins, results:[1,0,…newest first]}, streak: {kind:'win'|'loss', len},
  graded_at }
```

Each row/card shows:
- Rank, system **name**, **username**, sport chip
- A plain-English bet line derived from verdict + bet_type, e.g. "Bets the Under" /
  "Bets ON matching teams" / "Fades matching teams" — never the raw word "team"/"fade"
- **Record** `wins-losses` (+pushes if >0), **ROI** (green/red, the ranking stat),
  **units** (e.g. "+23.6u")
- Sample-size badge: **Early** (10–29 games) / **Established** (30–99) / **Proven** (100+)
- **This season**: record + ROI from `current_season` (label with `season_label`)
- **Since shared**: record from `since_saved` — subtitle "record since this system was
  saved" (this is the honest forward-looking number; show "0-0 so far" when n=0)
- **Last 10**: ten win/loss dots from `last10.results` (newest on the right) + "8 of last 10"
- **Streak** chip when len >= 3: "🔥 5 straight" (win) / "❄️ 4 straight misses" (loss)
- Sport filter pills (All / NFL / CFB / MLB) → re-call the RPC with p_sport

**Click-through**: navigate to that sport's analytics page and restore the row's
`filters` snapshot through the page's EXISTING saved-filter restore path (same code path
as loading a saved filter), then show a banner: "Viewing **{name}** by {username} — bets
{plain-English side}. Save your own copy to track it." The banner's save button opens the
save dialog pre-filled with the same verdict.

Anon/signed-out users may VIEW the leaderboard (the RPC allows it); saving still requires
sign-in.

## My saved systems (small upgrade)

Where saved filters are listed today, for rows that have a `verdict` show: the plain-English
bet line, since-saved record, and the share toggle + rename (again: update only
`name`/`is_public`). Legacy saves without a verdict just keep working as filter restores —
label them "filters only (save again to track as a System)".

## Guardrails

- READ but never modify: `src/features/analysis/*`, `supabase/*`.
- The symmetric-case side chooser must reuse the exported `isSideSymmetric*` helpers —
  do not re-derive the classification.
- No client-side computation of records — every number on the leaderboard comes from the
  RPC payload. If `graded_at` is old or fields are null, show "grading nightly — check
  back tomorrow", never a made-up number.
- Keep ranking exactly as returned (server ranks by ROI).

## Run & hand-off (testing only)

- `npm run dev`, signed in:
  1. On `/mlb` analytics set filters "home + underdog + lost last game" (ml) → Save →
     verify the dialog asks the side question, save with "Bet ON these teams" + share OFF.
  2. Set ONLY a weather/game filter on NFL spread → Save → verify the side-chooser
     appears first and picking "Home teams" sets the chip.
  3. Leaderboard page renders (it may be empty — no public systems exist yet; verify the
     empty state reads well: "No shared systems yet — be the first").
  4. To see a populated row locally, temporarily set your own test save `is_public=true`
     from the UI toggle, refresh the leaderboard, then toggle it back OFF before finishing.
- **Do NOT commit / push / deploy.** Report what you tested + any copy you changed.
