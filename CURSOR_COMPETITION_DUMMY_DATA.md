# Competition page: TEMPORARY dummy data is live (build against it, don't special-case it)

To let us style the **Most Picked** and **Leaderboard** surfaces with realistic
content before the season starts, a clearly-marked dummy week now exists on
MAIN. **It is temporary** — we'll tear it down once the pages look right, and
nothing in the UI should hard-code anything about it.

## What's seeded

- `comp_weeks`: season **2026, week_no 99, label "Preview Data (Dummy)"**,
  status `locked`, deadline 2 days in the PAST → all post-deadline behavior is
  real: `comp_week_stats(week_id)` returns data, and other users' entries/picks
  are visible through RLS exactly as they will be on a real Friday.
- 8 dummy games (real opening-weekend matchups, event ids prefixed `dummy_`),
  all final with scores.
- 12 dummy users (`profiles.username` = `comp_dummy_*`, display names like
  GridironGuru, TotalsTilly, FadeThePublic) with submitted, stamped, **graded**
  entries — 72 picks total.

## What the surfaces show right now

- **Most Picked** for week 99: a proper hero stat — 9 of 12 players on
  `TCU −7` (4 of them as POTW), 9 on `UNLV/Memphis Over 59`, then a long tail
  with split sides on Virginia/NC State. Good spread for testing bar scaling,
  side labels, and the POTW badge.
- **Season leaderboard** `comp_leaderboard(2026)`: 12 rows, records from 6-0-0
  down to 1-5-0, points 8 → 1 — and ranks 1–2 are BOTH 6-0 / 8 pts, separated
  only by Cover Points (+35.0 vs +28.0), so you can verify the tiebreaker
  presentation. Rank ties elsewhere (ranks 3–6 all at 7 pts) exercise the
  cover-sorted-within-points ordering.
- Weekly leaderboard: `comp_leaderboard(2026, <week99_id>)` returns the same
  users scoped to that week.

## Rules while it's up

1. **No special-casing.** Query weeks/stats/leaderboard exactly as the real
   page will. If you need a post-deadline week to render, select week 99 via
   the normal week picker — do not branch on `week_no === 99` or the label.
2. The real **Week 0 (Practice Round)** slate is untouched and remains the
   "current" pickable week; picking UX should still be built against week 0.
3. Don't filter out `comp_dummy_*` users — when we tear down, they're deleted
   outright, so no client-side exclusion is needed (and none should ship).

## Teardown (we run this, not you)

`python3 research/competition/comp_dummy_seed.py --teardown` deletes week 99
(games/entries/picks cascade) and the dummy auth users (profiles cascade),
returning the DB to exactly the pre-seed state. The same script re-seeds if we
need another look (`python3 comp_dummy_seed.py`).
