# Historical-trends warehouse — in-season refresh (NFL + CFB)

Keeps `nfl_analysis_base` / `cfb_analysis_base` (the exploded team-per-game tables behind
`/nfl-analytics`, `/cfb-analytics`, and the `/historical-trends` Systems workbench) growing as
2026 games complete. Parallels MLB's `refresh_mlb_analysis_base()`.

Warehouse: **`jpxnjuwglavsjbgbasnl`** (`collegeFootballSupabase`). Both base tables + the
`*_dryrun_games` source live here.

## Two stages

| Stage | What | Where | Runs |
|-------|------|-------|------|
| 0 — NFL meta | `load_nab_patch.py` stages coach + normalized surface (nflverse `games.csv`, all seasons) into `_nab_patch`. Stage 1 LEFT JOINs it. | `load_nab_patch.py` | daily, in `grade_week.sh` (before Stage 1) |
| 1 — core facts | `refresh_nfl_analysis_base(season)` / `refresh_cfb_analysis_base(season)` turn every completed `*_dryrun_games` row (`final_home` set) into the 2 exploded rows with ATS/OU/TT/1H results, weather, referee + coach + surface (NFL), conference/rank/neutral-site (CFB). | `refresh_football_analysis_base.sql` (SQL fns) → called by `run_grade_rpcs.py` | daily, in `grade_week.sh` |
| 2 — asof features | `asof_features_{nfl,cfb}.py` recompute the season-to-date / streak / h2h / opponent / prev-year family leak-safely and `deploy_asof.py` merges them back. | `refresh_analysis_asof.sh` | daily, in `grade_week.sh` (non-fatal; needs `SUPABASE_PAT`) |

Stage 1 alone makes completed games queryable for the core filters (spread/total/ATS/OU/team-total/
1H/conference/division/weather/referee/rank/primetime). Stage 2 adds the form/streak filters.

## Scope guard

Both RPCs **DELETE + re-insert scoped to `p_season`** and are idempotent within the live season.
**Only ever call for the live season (2026+).** Do NOT call for 2018–2025: those rows carry the
richer parquet-built columns (coach, surface, `_px`) that this SQL path does not populate, and would
be thinned out. `grade_week.sh` always passes the current season.

## Column coverage for the SQL-appended (2026+) rows

`coach` / `opp_coach` / `surface` (NFL) come from `_nab_patch` (Stage 0) — populated for the live
season as the nflverse schedule fills in. Everything the trend filters use is populated. Convention
correctness validated exactly against existing base rows: `2025_12_PHI_DAL` for NFL (incl. coach
Brian Schottenheimer / Nick Sirianni + surface Turf), game `401762484` Temple/Navy for CFB.

1H results (`h1_covered` / `h1_won` / `h1_total_over`) populate too: `fill_h1.py` (grade_week.sh
step 1b) writes `*_dryrun_games.h1_home/h1_away` from nflverse PBP (NFL) and CFBD `/games` line
scores (CFB), so the appender derives the 1H results just like the full game.

## Manual run

```sql
select public.refresh_nfl_analysis_base(2026);
select public.refresh_cfb_analysis_base(2026);
```
Then Stage 2: `SUPABASE_PAT=sbp_… bash ../nfl-extreme-outcomes/refresh_analysis_asof.sh 2026`
