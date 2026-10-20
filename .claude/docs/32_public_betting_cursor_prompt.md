# Cursor prompt — Public Betting page

Paste everything below the line into Cursor. The full spec it refers to is
`.claude/docs/31_public_betting_page_brief.md`.

---

Build a new page on the **web app** (`src/`) at `/public-betting`, nav label "Public Betting".

**Read these first, in this order, before writing any code:**

1. `.claude/docs/31_public_betting_page_brief.md` — the full spec. It owns the signal logic,
   the thresholds, the traps and the visual design. Follow it exactly; where I say something
   here that contradicts it, the brief wins.
2. `src/features/trendsToday/README.md` + `src/features/trendsToday/TrendsTodayPage.tsx` —
   the structural template. This page is the same shape: `SplitViewLayout`, feed left, detail
   right, URL state, React Query.
3. `src/features/games/detail/sections/nfl/NflBettingSplitsSection.tsx` and
   `src/features/games/detail/sections/shared/lineMovement.ts` — the existing splits and
   line-movement widgets. Take the colours and the vocabulary from them. ⛔ Do **not** take
   the logic: that path consumes a pre-baked string label and its sharp test is wrong for our
   purposes — §1 of the brief explains why in detail.

## What the page does

Shows Action Network public betting percentages — **tickets vs money** — for every upcoming
game we capture, across NFL, CFB, NBA and NCAAB, for spread, total and moneyline. Filterable
by sport and by market. On top of the raw percentages it reads tickets + money + line
movement together and labels what the market is doing, with the graphics carrying the read.

The signal that matters, in full, is §1 of the brief. The short version — and this is a
**real row off the board right now**, not a hypothetical:

```
cfb  Indiana @ Michigan  total
  Opened 52.5, consensus now 41.5      ← the line moved 11 points toward the UNDER
  Bets:   83% OVER  /  17% UNDER       ← the public is on the over
  Money:  64% OVER  /  36% UNDER       ← the under has 36% of the money on 17% of the tickets

=> SHARP MONEY ON THE UNDER   (heavy tickets one way, money share the other, line confirming)
```

Heavy tickets one way, the other side's money share bigger than its ticket share, and the
line moving toward that other side. All three, or it is not the signal.

§5 of the brief lists the required unit tests, and the first five are **real rows off the live
board** — fixtures, not invented numbers. Build until those pass.

## Getting the data — the part that is easy to get wrong

Table: `action_public_splits` on the **CFB** Supabase instance, via
`src/integrations/supabase/college-football-client.ts` (not the main client). It is a
**change log** — one row per capture, only when something moved.

- Read the **`action_public_splits_board`** view, never the raw table. The view already
  returns the newest row per `(game_id, market)` — that is the current board, deduped in
  Postgres. It is live: 252 rows / 84 games as of 2026-10-20, and the anon key can read it
  (the raw log stays invisible to anon by design).
- One query for the whole board (a few hundred rows across four leagues), then filter by
  sport and market **client-side**. Do not fetch per card and do not reduce latest-per-key in
  JS.
- Group the rows into games: up to three market rows share a `game_id`. A missing market is
  absent, not empty — many games have no ml.

Orientation rule you must not get backwards: **the "away" slot is the away team for
spread/ml and the OVER for totals.** `bets_away` on a total row means bets on the over.

⛔ **`away_close` is not the current line — `away_cons` is.** `away_close`/`home_close` are
*best odds per side* (on a total the over wants the lowest number and the under the highest),
so neither is a line, and reconstructing one from them yields quarter points no book posts.
`away_cons`/`home_cons` are the consensus book's real posted line, from the same book the
percentages come from. Movement is `cons − open`. Formulas for all three markets in §1.
**If a `.25` line ever reaches the screen, you used the wrong column.**

⛔ **Two gates, or this fires on two thirds of the slate.** Run against tonight's real board,
the rule without them produced a candidate on 54 of 84 games; with them, 5. Moneyline gets no
tier (the ML public sits on favourites, so splits run 1/99 and one dog bet reads as a 70pp
tilt), and the quiet side needs ≥15% of the tickets. Both are in §1.

## Build it in this order

1. `types.ts` and `api/` — the fetch and the row → game reshape.
2. `signals.ts` + `signals.test.ts` — all direction and tier logic, tested, **before any
   UI**. Every case in §5 of the brief. This is where the page is right or wrong; a sign flip
   here inverts every card silently, which has happened in this repo before.
3. The feed: list, sport pills, market pills, tier filter, sort.
4. The graphics (§5 of the brief): the divergence bar, the line-move rail, and the
   confirmation glyph where the wedge and the arrow match colour exactly when the line is
   following the money.
5. The detail pane: all three markets, the full tier sentence, the "how to read this" block.
6. `README.md` for the module.

## Non-negotiables

- ⛔ **No picks.** The page describes the market; it never says to bet something, shows a
  conviction tier, or links a betslip. The model's picks live on `/games` and these two
  surfaces must never contradict each other in public.
- ⛔ **0% / 100% on either side is NO DATA, not unanimity**, and games under 200 tickets are
  excluded. Both are filtered out of the feed entirely, not greyed out.
- ⛔ **American odds cannot be subtracted.** `+105 → −113` moves *toward* that side but
  subtracts to −218. Moneyline direction goes through no-vig implied probability. Formula
  in §1.
- ⛔ **A missing opener is `null`, not a flat line.** No opener means no direction and no
  tier-1 match.
- ⛔ **Label the source as Action Network in the UI.** The game cards use The Odds API and the
  NFL splits label there comes from VSiN; the numbers differ by a point or two on the same
  game. Never compute a gap between an AN number and one of ours.
- Build the sport pills from the sports actually present in the response. NCAAB has no rows
  until November and there is no MLB at all — a hardcoded chip that returns an empty board
  reads as a broken page.
- Register the route in `SPLIT_VIEW_ROUTES` in `src/App.tsx` or the page loses its internal
  scrolling, and add it to `src/nav-items.tsx`.
- Web only. iOS and Android are separate native codebases and are not in scope.

## Done when

`/public-betting` renders NFL, CFB and NBA off the board view, filters by sport and market,
Indiana @ Michigan shows **Sharp Money on the Under** on a real card, `signals.test.ts` covers
every case in §5, `npm test` is green, `npm run build` is clean, and the module README is
written.

Sanity checks before you call it done: on a full board, tier 1 should fire on a handful of
games, not dozens — the real 84-game board produces 4 tier-1 and 5 tier-2. And every line on
screen must be a whole or half point; a `.25` means movement is coming off `*_close` instead
of `*_cons`.

Ask me before: applying any SQL, adding a dependency, or touching anything outside
`src/features/publicBetting/`, `src/App.tsx` and `src/nav-items.tsx`.
