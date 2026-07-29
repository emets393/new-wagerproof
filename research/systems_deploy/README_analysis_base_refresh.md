# Historical-trends warehouse — in-season refresh (NFL + CFB)

Keeps `nfl_analysis_base` / `cfb_analysis_base` (the exploded team-per-game tables behind
`/nfl-analytics`, `/cfb-analytics`, and the `/historical-trends` Systems workbench) growing as
2026 games complete. Parallels MLB's `refresh_mlb_analysis_base()`.

Warehouse: **`jpxnjuwglavsjbgbasnl`** (`collegeFootballSupabase`). Both base tables + the
`*_dryrun_games` source live here.

## Two stages

| Stage | What | Where | Runs |
|-------|------|-------|------|
| 1 — core facts | `refresh_nfl_analysis_base(season)` / `refresh_cfb_analysis_base(season)` turn every completed `*_dryrun_games` row (`final_home` set) into the 2 exploded rows with ATS/OU/TT/1H results, weather, referee (NFL), conference/rank/neutral-site (CFB). | `refresh_football_analysis_base.sql` (SQL fns) → called by `run_grade_rpcs.py` | daily, in `grade_week.sh` |
| 2 — asof features | `asof_features_{nfl,cfb}.py` recompute the season-to-date / streak / h2h / opponent / prev-year family leak-safely and `deploy_asof.py` merges them back. | `refresh_analysis_asof.sh` | daily, in `grade_week.sh` (non-fatal; needs `SUPABASE_PAT`) |

Stage 1 alone makes completed games queryable for the core filters (spread/total/ATS/OU/team-total/
1H/conference/division/weather/referee/rank/primetime). Stage 2 adds the form/streak filters.

## Scope guard

Both RPCs **DELETE + re-insert scoped to `p_season`** and are idempotent within the live season.
**Only ever call for the live season (2026+).** Do NOT call for 2018–2025: those rows carry the
richer parquet-built columns (coach, surface, `_px`) that this SQL path does not populate, and would
be thinned out. `grade_week.sh` always passes the current season.

## Known column gaps for the SQL-appended (2026+) rows

`coach` / `opp_coach` / `surface` (NFL) are not in `*_dryrun_games`; they stay NULL until the
nflverse `load_nab_patch.py` coach patch is extended to the live season. Everything the primary
trend filters use is populated. Convention correctness validated exactly against existing base rows
(`2025_12_PHI_DAL` for NFL, game `401762484` Temple/Navy for CFB).

## Manual run

```sql
select public.refresh_nfl_analysis_base(2026);
select public.refresh_cfb_analysis_base(2026);
```
Then Stage 2: `SUPABASE_PAT=sbp_… bash ../nfl-extreme-outcomes/refresh_analysis_asof.sh 2026`
