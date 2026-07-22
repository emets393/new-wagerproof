# Systems Leaderboard — backend (live 2026-07-22)

Saved analysis filters become shareable **systems**: a filter set + an explicit **verdict**
(which side the system bets), graded nightly against the same warehouse engine the pages
use, ranked by all-time ROI on a public leaderboard.

## Design decisions (locked with owner)

- **Verdict chosen at save time.** Sides markets: `team` (bet the team matching the
  filters) or `fade` (bet against it). Totals/team totals: `over` / `under`. If a side
  market's filters are symmetric (no team-defining filter), the save dialog forces a
  Home/Away/Favorite/Underdog choice — which literally sets that filter. No symmetry
  rejection ever surfaces to users.
- **Min 10 games** (`all_time.n >= 10`) for leaderboard eligibility — sample size of
  games matching the system's filters (not a “since you shared” count). Display
  sample-size badges: Early 10–29 / Established 30–99 / Proven 100+. User-facing copy
  should say “10+ games”, not “10+ graded games” / overnight grading as the share gate.
- **Since-saved tracked from day one** — the record produced only AFTER the save; the
  honest number. Filters are immutable post-save (no UPDATE grant on them): editing =
  new save = since-saved resets by construction.
- **Public is opt-in** at save time (`is_public`, default false).

## Architecture

**Warehouse (jpxnjuwglavsjbgbasnl)** — one filter engine, two readers:
- `{nfl,cfb,mlb}_system_rows(p_bet_type, p_filters)` — the *_analysis WHERE + hit/profit
  math extracted into a rows-returning fn (adds `opp_hit`/`opp_profit` via a LATERAL
  mirror join for fades; MLB keeps `keep_game`). EXECUTE: service_role only.
- `{nfl,cfb,mlb}_analysis` — REWRITTEN to `SELECT * FROM {sport}_system_rows(...)`.
  Equivalence-verified on 21 probe payloads (byte-identical) at deploy. **Any new filter
  is added ONCE, in system_rows** — regenerate with
  `research/systems_deploy/build_system_rows.py` (dumps live defs, re-extracts, redeploys).

**Main project (gnjrklxotmbvnxbnnqgq)**:
- Saved tables (`{sport}_analysis_saved_filters`) extended: `verdict`, `rpc_bet_type`,
  `rpc_filters` (the EXACT payload the page queried with — client saves it, no server-side
  snapshot translation), `is_public`, `filters_hash`, `since_saved`, `graded_at`.
  UPDATE grant: `name`, `is_public` only.
- `analysis_system_performance` — cache keyed (sport, filters_hash);
  hash = sha256(sport|rpc_bet_type|verdict|canonical rpc_filters), grader-computed.
  Shapes: `all_time`/`current_season`/`since_saved` = {n,wins,losses,pushes,hit_pct,roi,units};
  `last10` = {n,wins,results[newest-first]}; `streak` = {kind,len}.
- `analysis_systems_leaderboard(p_sport?, p_limit=50)` — top public systems by all-time
  ROI, n≥10, joined with profiles for username; each row carries the UI `filters` snapshot
  so click-through restores the exact page state. Anon-callable.
  **Web** (`/historical-trends`) is multi-sport: the leaderboard UI requires a Sport filter
  (All / MLB / NFL / CFB). `All` calls this RPC once per sport and merges by ROI; a single
  sport passes only that `p_sport`. Native/Expo screens stay sport-scoped.
- Edge Function `grade-analysis-systems` (verify_jwt off, guarded by `x-cron-secret` =
  GRADE_CRON_SECRET; secrets: WAREHOUSE_URL/WAREHOUSE_SERVICE_KEY). Groups saves by hash,
  fetches rows once per unique system, computes cache + per-save since_saved.
  Dedupe mirrors each page exactly: NFL/CFB game totals = home rows; MLB = home-preferred.
- pg_cron `grade-analysis-systems-daily` at 09:20 UTC via net.http_post.

## Grading semantics

Per-row outcome from the saved verdict's perspective; pushes (null hit) excluded from
records; rows without a price excluded from ROI only. `fade` = mirror row's result at the
mirror row's price. Current season: MLB = calendar year; NFL/CFB = Aug+ rolls forward.

## Upcoming-games filters (today's matches)

`mlb_analysis_upcoming` v2 (2026-07-22) supports the FULL as-of filter family with the
same keys as `mlb_analysis` — current-season form (records/streaks/rates/prev-year),
last-game flags, opponent mirrors, and H2H are computed live from `mlb_analysis_base`
at query time (source: `research/systems_deploy/rpc_extended/mlb_analysis_upcoming_v2.sql`).
`day_of_week` is array-typed (parity with base). **NFL/CFB `*_analysis_upcoming` still
lack the as-of keys** — they silently ignore them; extend them the same way at 2026
football go-live (they're off-season/dry-run today).

## Known data quirks

- MLB base: one 2024-05-08 ATH/TEX doubleheader has crossed results (both rows of each
  game share ml_won) — source ingest bug, 2 games, flagged by the fade complement check.
  The mirror join is case-blind (`upper()`) so the pending 'Ath' dupes can't self-match.
- NFL/CFB pages count game-level totals from HOME rows only; a team-perspective filter
  that matches only away rows drops those games from totals aggregates. Grader mirrors
  this (page consistency wins); fix both together if ever revisited.
- 2026-07-22: `mlb_analysis_saved_filters` was missing from prod (migration never applied)
  — created during this build. MLB saves before this date silently failed.

## E2E verification (2026-07-22)

3 private systems on the owner account graded correctly (e.g. MLB fade road favorites
after a blowout win: 698 bets, 54.2%, +3.4% ROI, 8-of-last-10). Grader cache matched
`mlb_analysis` overall EXACTLY. Leaderboard RPC shape verified in a rolled-back txn.
