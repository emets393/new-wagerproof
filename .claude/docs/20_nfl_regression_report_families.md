# NFL regression report — storyline families and where each comes from

The `/nfl/regression-report` page (`src/features/footballRegression/FootballRegressionPage.tsx`)
renders one card per row of `football_regression_storylines` (CFB Supabase), grouped by `family`,
plus an LLM narrative written from the cards only. `research/nfl-extreme-outcomes/gen_nfl_regression_report.py`
owns ranking, family quotas, the append-only sync (`football_report_lib.sync_storylines`) and the
narrative. It runs on the daily Render cron and has NO research parquets on disk, so any family that
needs them is computed by a generator on the `fp-data-inseason` job (Tue/Thu) into a staging table
that the report generator reads.

## Families

| family | generator (staging table) | what it is | source line |
|---|---|---|---|
| `matchups` | `nfl_matchup_facts.py` → `nfl_matchup_facts` | Featured matchups: Fantasy Points scheme facts × model / signals / weather / referee / injuries | prior + current season |
| `storylines` | `nfl_week_storylines.py` → `nfl_week_storylines` | Players facing a former team (seasons there, drafted by them, first meeting, old stadium, messy exit), visiting near their birthplace (with their own homecoming record), QBs in a birthday week | prop lines 2023-25; ESPN birthplaces; rosters 2016-25 |
| `coaching` | same | Both offensive play-callers (identity, red-zone pass rate inside 20/10/5, goal-line back usage, situational shifts LIVE this week) and both defensive coordinators (blitz/box identity, shifts live this week) | play-by-play 2022-25 + FTN charting, keyed to `data/play_callers.csv` / `data/coaching_staff.csv` |
| `player_tendencies` | same | Per-player tendencies that hold every season AND whose trigger is live this week (wind, cold/heat, spread, total, home/road, rest, blitz-heavy opponent); anytime-TD tendencies whose situation is on | each player's priced lines 2023-25 (`data/_qb_profiles_*_2026.parquet`, `data/_atd_player_profiles_2026.parquet`) |
| `redzone_roles` | same (only when this season's charted snaps are on disk, week 3+) | Inside-5 snap share last 3 games vs season: goal-line role growing / shrinking | this season's Fantasy Points snaps |
| `signals`, `line_movement`, `ref_trends`, `coach_trends`, `confluence`, `injuries` | `gen_nfl_regression_report.py` directly | unchanged | — |

## Card contract

Every staged row carries `data.full` (markdown rundown, expands in place on the card) and
`data.source` (which seasons / how many games or plays the numbers come from — rendered as a
"Source:" line under the card). The narrative prompt tells the LLM these families have their own
cards: mention the two or three most noteworthy in one sentence each, with the source in plain
words, and never rewrite them. NO PICKS anywhere; a card says what the data shows.

## Rules the generators follow

- Tendencies are listed only when the sign holds in every season with enough games (per-player:
  8+ priced games per season; coaches: 60+ plays per season and a 3-point gap vs the league's own
  shift in that situation). Odd/even halves are never used for stability.
- Zero-stat rows from Fantasy Points are zeros, not missing (the "missing row is zero" leak).
- A situational shift is reported RELATIVE to how the league shifts in that spot, so "he throws
  more in primetime" means more than everyone throws more in primetime.
- Storyline reads quoted on cards are the validated cells from `FPDATA_RESEARCH_PROGRAM.md`
  (QB vs former team → passing-TD line under 70%; skill player in his first season away → over 60%;
  QB birthday week → over 62%, small; QB visiting near home → under 63%, small). Homecoming as a
  group is priced; the player's own record is the tell.
- The market prices red-zone usage and goal-line concentration: lead backs under ride-the-starter
  callers hit 40.5% vs 45.5% implied. Coaching cards explain, they do not lean.

## Maintenance

`data/play_callers.csv` (who calls the plays) and `data/coaching_staff.csv` (Wikipedia staff pages,
`coaching_staff_pull.py`) need an offseason refresh; the per-player profile parquets are rebuilt by
`qb_profiles.py 2026 <market>` and `atd_player_profiles.py 2026` and are git-tracked so the Render
job has them. Table DDL for `nfl_week_storylines` was applied via the Management API (see the
`supabase-ddl-management-api` memory); it has RLS enabled and no anon policy — only the service key
reads/writes it.

## Player Prop Report (`/nfl/regression-report/props`)

`nfl_prop_narratives.py` scores every posted prop with tells and keeps the players where 3+ tells
point one way (net ≥ 2). Since 2026-09-19 it also takes `research_tells.py`:
- **tendency** (weight 1.5): the player's own every-season tendency from the priced-line profiles
  whose trigger is live this week (wind, heat/cold, favorite/underdog, total, home/road, rest,
  blitz-heavy or low-blitz opponent from the coordinator's 2022-25 rate).
- **storyline** (1.5 / 1.0): QB vs a former team → passing yards/TDs under; skill player in his
  first season away vs the old team → over; QB birthday week → passing yards over (small); a
  player's own homecoming or former-team record when 3+ games and lopsided.
- **coaching** (1.0): the play-caller's stable situational shift that is live this week
  (pass-heavy → QB volume and receivers over; run-heavy → rushing over, pass attempts under).
Each tell's text carries its seasons and counts. The card body groups them under "His own
tendencies", "Storylines" and "Play-caller".

**Grading.** Two graders write `nfl_prop_narratives.result` / `actual_value`, both idempotent (only
`result IS NULL` rows):
- `grade_props_espn.py SEASON WEEK --write` — same day. `espn_nfl_boxscores.py` pulls ESPN's public
  summary endpoint for every FINAL game (524 player lines for 8 games in ~10 s), maps ESPN ids to gsis
  via `data/players_xwalk.parquet`, and grades reads plus every `nfl_prop_model_preds` row (side =
  sign of pred − line). Projection grades go to `out/prop_projection_grades_{season}_wk{week}.csv`
  (the preds table has no result column). Runs in `grade_week.sh`.
- `grade_nfl_prop_narratives.py` — overnight, from `nfl_player_props` (nflverse logs). Fills whatever
  ESPN left (games not final at run time). Same box score, same answer.
A player with no box-score line in a final game is `dnp` (not graded), matching the book's void.
